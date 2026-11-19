import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { neon } from "@neondatabase/serverless";

const scryptAsync = promisify(scrypt);
const passwordLength = 64;
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const sessionLifetimeSeconds = 30 * 60;
const loginWindowMinutes = 15;
const maxLoginAttempts = 5;
const maxBodyBytes = 5 * 1024 * 1024;
const maxCoverCharacters = 4 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function database() {
  if (!process.env.DATABASE_URL) {
    throw new HttpError(503, "Configure DATABASE_URL nas variáveis do Vercel.");
  }
  return neon(process.env.DATABASE_URL);
}

function setSecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function routePath(request) {
  const route = request.query?.route;
  if (typeof route === "string") return `/${route.replace(/^\/+/, "")}`;
  const pathname = new URL(request.url, "https://vercel.invalid").pathname;
  return pathname.replace(/^\/api\/?/, "/");
}

async function readJsonBody(request) {
  if (!(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Envie os dados no formato JSON.");
  }

  if (request.body !== undefined) {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new HttpError(400, "Os dados enviados são inválidos.");
    }
    return request.body;
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) {
      throw new HttpError(413, "A solicitação excede o tamanho permitido.");
    }
    chunks.push(chunk);
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("JSON body must be an object.");
    }
    return body;
  } catch {
    throw new HttpError(400, "Os dados enviados são inválidos.");
  }
}

function cookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const separator = item.indexOf("=");
        return separator === -1
          ? [item, ""]
          : [item.slice(0, separator), item.slice(separator + 1)];
      }),
  );
}

function sessionCookie(value, maxAge) {
  const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production"
    ? "; Secure"
    : "";
  return `margem_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function verifySameOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) throw new HttpError(403, "Origem da solicitação não autorizada.");
  try {
    const parsedOrigin = new URL(origin);
    const requestHost = host.split(",")[0].trim().toLowerCase();
    const expectedProtocol = process.env.NODE_ENV === "production" ? "https:" : parsedOrigin.protocol;
    if (
      parsedOrigin.host.toLowerCase() !== requestHost
      || parsedOrigin.protocol !== expectedProtocol
      || !["http:", "https:"].includes(parsedOrigin.protocol)
    ) {
      throw new HttpError(403, "Origem da solicitação não autorizada.");
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(403, "Origem da solicitação não autorizada.");
  }
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new HttpError(403, "Solicitação entre sites não autorizada.");
  }
}

function clientAddress(request) {
  const value = request.headers["x-real-ip"] || request.headers["x-forwarded-for"] || "unknown";
  return String(value).split(",")[0].trim().slice(0, 100);
}

function sessionToken(request) {
  const token = cookies(request).margem_session;
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) return null;
  return token;
}

async function currentSession(sql, request) {
  const token = sessionToken(request);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const [session] = await sql`
    SELECT token_hash
    FROM admin_sessions
    WHERE token_hash = ${tokenHash} AND expires_at > now()
  `;
  return session ? { tokenHash } : null;
}

async function requireSession(sql, request) {
  const current = await currentSession(sql, request);
  if (!current) throw new HttpError(401, "Entre novamente no Painel ADM.");
  return current;
}

async function requireChangedPassword(sql) {
  const [credentials] = await sql`
    SELECT must_change_password
    FROM admin_credentials
    WHERE id = 'admin'
  `;
  if (!credentials) throw new HttpError(503, "Configure o acesso ADM inicial no Vercel.");
  if (credentials.must_change_password) {
    throw new HttpError(403, "Troque a senha inicial antes de continuar.");
  }
}

async function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function passwordMatches(password, saltHex, passwordHashHex) {
  const actual = await scryptAsync(
    password,
    Buffer.from(saltHex, "hex"),
    passwordLength,
    scryptOptions,
  );
  const expected = Buffer.from(passwordHashHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function validateUsername(username) {
  return typeof username === "string" && /^[a-zA-Z0-9._-]{3,32}$/.test(username);
}

async function initializeAdmin(sql) {
  const [saved] = await sql`
    SELECT id
    FROM admin_credentials
    WHERE id = 'admin'
  `;
  if (saved) return;

  const username = process.env.ADMIN_INITIAL_USERNAME || "";
  const password = process.env.ADMIN_INITIAL_PASSWORD || "";
  if (!validateUsername(username) || password.length < 1 || password.length > 1024) {
    throw new HttpError(
      503,
      "Configure ADMIN_INITIAL_USERNAME e ADMIN_INITIAL_PASSWORD no Vercel para iniciar o ADM.",
    );
  }

  const salt = randomBytes(16);
  const passwordHash = await scryptAsync(password, salt, passwordLength, scryptOptions);
  await sql`
    INSERT INTO admin_credentials (id, username, salt, password_hash, must_change_password)
    VALUES (
      'admin',
      ${username},
      ${salt.toString("hex")},
      ${passwordHash.toString("hex")},
      ${password.length < 12}
    )
    ON CONFLICT (id) DO NOTHING
  `;
}

function publicMagazine(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    issue: row.issue,
    cover: row.cover,
    coverTitle: row.cover_title,
    position: "center",
  };
}

async function loadMagazines(sql) {
  const rows = await sql`
    SELECT m.id, m.title, c.name AS category, m.description, m.price,
           m.issue, m.cover, m.cover_title
    FROM magazines m
    JOIN categories c ON c.id = m.category_id
    ORDER BY m.sort_order, m.created_at, m.id
  `;
  return rows.map(publicMagazine);
}

async function loadCategories(sql) {
  return sql`
    SELECT id, name
    FROM categories
    ORDER BY sort_order, name
  `;
}

function validateMagazine(body, existing = null) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const price = Number(body.price);
  const cover = typeof body.cover === "string" ? body.cover : existing?.cover;
  let validCover = false;
  if (typeof cover === "string" && cover.length <= maxCoverCharacters) {
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(cover)) {
      validCover = true;
    } else {
      try {
        const coverUrl = new URL(cover);
        validCover = coverUrl.protocol === "https:" && coverUrl.hostname === "images.unsplash.com";
      } catch {
        validCover = false;
      }
    }
  }

  if (!title || title.length > 60) {
    throw new HttpError(400, "O título deve ter de 1 a 60 caracteres.");
  }
  if (typeof body.category !== "string") {
    throw new HttpError(400, "Escolha uma categoria válida.");
  }
  if (!description || description.length > 180) {
    throw new HttpError(400, "A descrição deve ter de 1 a 180 caracteres.");
  }
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
    throw new HttpError(400, "Informe um preço válido.");
  }
  if (!validCover) {
    throw new HttpError(400, "Envie uma capa JPEG válida ou mantenha a capa atual.");
  }
  return {
    title,
    category: body.category,
    description,
    price,
    cover,
    coverTitle: title.toLocaleUpperCase("pt-BR"),
  };
}

function validateCategoryName(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 40) {
    throw new HttpError(400, "O nome da categoria deve ter de 2 a 40 caracteres.");
  }
  return name;
}

async function findCategoryByName(sql, name) {
  const [category] = await sql`
    SELECT id, name
    FROM categories
    WHERE lower(name) = lower(${name})
  `;
  if (!category) throw new HttpError(400, "Escolha uma categoria válida.");
  return category;
}

async function handleApi(request, response) {
  setSecurityHeaders(response);
  const method = request.method || "GET";
  const path = routePath(request);

  if (method === "OPTIONS") {
    verifySameOrigin(request);
    response.statusCode = 204;
    response.end();
    return;
  }

  const sql = database();

  if (method === "GET" && path === "/health") {
    await sql`SELECT 1 AS ok`;
    sendJson(response, 200, { service: "margem-api", version: 1 });
    return;
  }
  if (method === "GET" && path === "/magazines") {
    sendJson(response, 200, await loadMagazines(sql));
    return;
  }
  if (method === "GET" && path === "/categories") {
    sendJson(response, 200, await loadCategories(sql));
    return;
  }
  if (method === "GET" && path === "/auth/session") {
    const [credentials] = await sql`
      SELECT username, must_change_password
      FROM admin_credentials
      WHERE id = 'admin'
    `;
    const current = credentials ? await currentSession(sql, request) : null;
    sendJson(
      response,
      200,
      current
        ? {
            authenticated: true,
            username: credentials.username,
            mustChangePassword: credentials.must_change_password,
          }
        : { authenticated: false },
    );
    return;
  }

  if (method === "POST" && path === "/auth/login") {
    verifySameOrigin(request);
    await initializeAdmin(sql);
    const address = clientAddress(request);
    const [attempt] = await sql`
      SELECT attempts, window_started_at, blocked_until
      FROM login_attempts
      WHERE client_ip = ${address}
    `;
    if (attempt?.blocked_until && new Date(attempt.blocked_until).getTime() > Date.now()) {
      throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos para tentar novamente.");
    }

    const body = await readJsonBody(request);
    const [credentials] = await sql`
      SELECT username, salt, password_hash, must_change_password
      FROM admin_credentials
      WHERE id = 'admin'
    `;
    const suppliedPassword = typeof body.password === "string" ? body.password : "";
    const password = suppliedPassword.length <= 1024 ? suppliedPassword : "";
    const usernameMatches = typeof body.username === "string"
      && body.username === credentials.username;
    const validPassword = await passwordMatches(password, credentials.salt, credentials.password_hash);
    if (suppliedPassword.length > 1024 || !usernameMatches || !validPassword) {
      const [updatedAttempt] = await sql`
        INSERT INTO login_attempts (client_ip, attempts, window_started_at, blocked_until)
        VALUES (${address}, 1, now(), NULL)
        ON CONFLICT (client_ip) DO UPDATE SET
          attempts = CASE
            WHEN login_attempts.window_started_at <= now() - (${loginWindowMinutes} * interval '1 minute') THEN 1
            ELSE login_attempts.attempts + 1
          END,
          window_started_at = CASE
            WHEN login_attempts.window_started_at <= now() - (${loginWindowMinutes} * interval '1 minute') THEN now()
            ELSE login_attempts.window_started_at
          END,
          blocked_until = CASE
            WHEN (
              CASE
                WHEN login_attempts.window_started_at <= now() - (${loginWindowMinutes} * interval '1 minute') THEN 1
                ELSE login_attempts.attempts + 1
              END
            ) >= ${maxLoginAttempts} THEN now() + (${loginWindowMinutes} * interval '1 minute')
            ELSE NULL
          END
        RETURNING blocked_until
      `;
      const locked = updatedAttempt?.blocked_until
        && new Date(updatedAttempt.blocked_until).getTime() > Date.now();
      throw new HttpError(
        locked ? 429 : 401,
        locked
          ? "Muitas tentativas. Aguarde 15 minutos para tentar novamente."
          : "Usuário ou senha incorretos.",
      );
    }

    await sql`DELETE FROM login_attempts WHERE client_ip = ${address}`;
    const token = randomBytes(32).toString("hex");
    const tokenHash = await hashToken(token);
    await sql`
      INSERT INTO admin_sessions (token_hash, expires_at)
      VALUES (${tokenHash}, now() + (${sessionLifetimeSeconds} * interval '1 second'))
    `;
    response.setHeader("Set-Cookie", sessionCookie(token, sessionLifetimeSeconds));
    sendJson(response, 200, {
      authenticated: true,
      username: credentials.username,
      mustChangePassword: credentials.must_change_password,
    });
    return;
  }

  if (method === "POST" && path === "/auth/change-password") {
    verifySameOrigin(request);
    const current = await requireSession(sql, request);
    const body = await readJsonBody(request);
    const [credentials] = await sql`
      SELECT username, salt, password_hash
      FROM admin_credentials
      WHERE id = 'admin'
    `;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!await passwordMatches(currentPassword, credentials.salt, credentials.password_hash)) {
      throw new HttpError(401, "A senha atual está incorreta.");
    }
    if (newPassword.length < 12 || newPassword.length > 1024) {
      throw new HttpError(400, "A nova senha precisa ter pelo menos 12 caracteres.");
    }
    if (newPassword === currentPassword) {
      throw new HttpError(400, "Escolha uma senha diferente da senha atual.");
    }

    const salt = randomBytes(16);
    const passwordHash = await scryptAsync(newPassword, salt, passwordLength, scryptOptions);
    const token = sessionToken(request);
    const tokenHash = await hashToken(token);
    await sql.transaction([
      sql`
        UPDATE admin_credentials
        SET salt = ${salt.toString("hex")},
            password_hash = ${passwordHash.toString("hex")},
            must_change_password = false,
            updated_at = now()
        WHERE id = 'admin'
      `,
      sql`DELETE FROM admin_sessions WHERE token_hash <> ${tokenHash}`,
      sql`
        UPDATE admin_sessions
        SET expires_at = now() + (${sessionLifetimeSeconds} * interval '1 second')
        WHERE token_hash = ${current.tokenHash}
      `,
    ]);
    response.setHeader("Set-Cookie", sessionCookie(token, sessionLifetimeSeconds));
    sendJson(response, 200, { changed: true, mustChangePassword: false });
    return;
  }

  if (method === "POST" && path === "/auth/logout") {
    verifySameOrigin(request);
    const token = sessionToken(request);
    if (token) {
      await sql`DELETE FROM admin_sessions WHERE token_hash = ${await hashToken(token)}`;
    }
    response.setHeader("Set-Cookie", sessionCookie("", 0));
    sendJson(response, 200, { loggedOut: true });
    return;
  }

  if (path === "/magazines" && method === "POST") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const body = await readJsonBody(request);
    const magazine = validateMagazine(body);
    const category = await findCategoryByName(sql, magazine.category);
    const [created] = await sql`
      INSERT INTO magazines (id, title, category_id, description, price, issue, cover, cover_title, sort_order)
      VALUES (
        ${randomUUID()}, ${magazine.title}, ${category.id}, ${magazine.description},
        ${magazine.price}, 'Nova edição', ${magazine.cover}, ${magazine.coverTitle},
        COALESCE((SELECT max(sort_order) + 1 FROM magazines), 0)
      )
      RETURNING id, title, description, price, issue, cover, cover_title
    `;
    sendJson(response, 201, {
      magazine: publicMagazine({ ...created, category: category.name }),
    });
    return;
  }

  const magazineMatch = path.match(/^\/magazines\/([a-z0-9][a-z0-9-]{2,79})$/i);
  if (magazineMatch && method === "PUT") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const body = await readJsonBody(request);
    const [existing] = await sql`
      SELECT m.id, m.cover
      FROM magazines m
      WHERE m.id = ${magazineMatch[1]}
    `;
    if (!existing) throw new HttpError(404, "Revista não encontrada.");
    const magazine = validateMagazine(body, existing);
    const category = await findCategoryByName(sql, magazine.category);
    const [updated] = await sql`
      UPDATE magazines
      SET title = ${magazine.title},
          category_id = ${category.id},
          description = ${magazine.description},
          price = ${magazine.price},
          cover = ${magazine.cover},
          cover_title = ${magazine.coverTitle}
      WHERE id = ${magazineMatch[1]}
      RETURNING id, title, description, price, issue, cover, cover_title
    `;
    sendJson(response, 200, {
      magazine: publicMagazine({ ...updated, category: category.name }),
    });
    return;
  }

  if (path === "/categories" && method === "POST") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const body = await readJsonBody(request);
    const name = validateCategoryName(body);
    const [count] = await sql`SELECT count(*)::int AS total FROM categories`;
    if (count.total >= 50) {
      throw new HttpError(409, "A loja já atingiu o limite de categorias.");
    }
    const [duplicate] = await sql`
      SELECT id FROM categories WHERE lower(name) = lower(${name})
    `;
    if (duplicate) throw new HttpError(409, "Já existe uma categoria com esse nome.");
    let category;
    try {
      [category] = await sql`
        INSERT INTO categories (id, name, sort_order)
        VALUES (${randomUUID()}, ${name}, COALESCE((SELECT max(sort_order) + 1 FROM categories), 0))
        RETURNING id, name
      `;
    } catch (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "Já existe uma categoria com esse nome.");
      }
      throw error;
    }
    sendJson(response, 201, { category });
    return;
  }

  const categoryMatch = path.match(/^\/categories\/([a-z0-9][a-z0-9-]{2,79})$/i);
  if (categoryMatch && method === "PUT") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const body = await readJsonBody(request);
    const name = validateCategoryName(body);
    const [existing] = await sql`
      SELECT id
      FROM categories
      WHERE id = ${categoryMatch[1]}
    `;
    if (!existing) throw new HttpError(404, "Categoria não encontrada.");
    const [duplicate] = await sql`
      SELECT id
      FROM categories
      WHERE lower(name) = lower(${name}) AND id <> ${categoryMatch[1]}
    `;
    if (duplicate) throw new HttpError(409, "Já existe uma categoria com esse nome.");
    let category;
    try {
      [category] = await sql`
        UPDATE categories
        SET name = ${name}
        WHERE id = ${categoryMatch[1]}
        RETURNING id, name
      `;
    } catch (error) {
      if (error.code === "23505") {
        throw new HttpError(409, "Já existe uma categoria com esse nome.");
      }
      throw error;
    }
    sendJson(response, 200, { category, magazines: await loadMagazines(sql) });
    return;
  }

  if (categoryMatch && method === "DELETE") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const [existing] = await sql`
      SELECT id FROM categories WHERE id = ${categoryMatch[1]}
    `;
    if (!existing) throw new HttpError(404, "Categoria não encontrada.");
    const [magazine] = await sql`
      SELECT id FROM magazines WHERE category_id = ${categoryMatch[1]} LIMIT 1
    `;
    if (magazine) {
      throw new HttpError(409, "Mova as revistas para outra categoria antes de excluí-la.");
    }
    const [count] = await sql`SELECT count(*)::int AS total FROM categories`;
    if (count.total <= 1) {
      throw new HttpError(409, "A loja precisa ter ao menos uma categoria.");
    }
    try {
      await sql`DELETE FROM categories WHERE id = ${categoryMatch[1]}`;
    } catch (error) {
      if (error.code === "23503") {
        throw new HttpError(409, "Mova as revistas para outra categoria antes de excluí-la.");
      }
      throw error;
    }
    sendJson(response, 200, { removed: true });
    return;
  }

  if (magazineMatch && method === "DELETE") {
    verifySameOrigin(request);
    await requireSession(sql, request);
    await requireChangedPassword(sql);
    const [removed] = await sql`
      DELETE FROM magazines
      WHERE id = ${magazineMatch[1]}
      RETURNING id
    `;
    if (!removed) throw new HttpError(404, "Revista não encontrada.");
    sendJson(response, 200, { removed: true });
    return;
  }

  throw new HttpError(404, "Página não encontrada.");
}

export default async function handler(request, response) {
  try {
    await handleApi(request, response);
  } catch (error) {
    if (response.writableEnded) return;
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error("Erro ao processar solicitação da API Margem.", error);
    sendJson(
      response,
      status,
      { error: status === 500 ? "Erro interno do servidor." : error.message },
    );
  }
}
