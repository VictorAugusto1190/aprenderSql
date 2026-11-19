const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const root = __dirname;
const dataDirectory = path.join(root, "data");
const credentialsPath = path.join(dataDirectory, "admin-credentials.json");
const magazinesPath = path.join(dataDirectory, "magazines.json");
const catalogPath = path.join(dataDirectory, "catalog.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const sessionLifetimeMs = 30 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const maxLoginAttempts = 5;
const maxRequestBytes = 5 * 1024 * 1024;
const maxCoverCharacters = 4 * 1024 * 1024;
const passwordLength = 64;
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const defaultCategories = [
  { id: "moda-autoral", name: "Moda autoral" },
  { id: "tendencias", name: "Tendências" },
  { id: "streetwear", name: "Streetwear" },
  { id: "beleza", name: "Beleza" },
  { id: "sustentabilidade", name: "Sustentabilidade" },
];
let magazineCategories = new Set(defaultCategories.map((category) => category.name));
const defaultMagazines = [
  {
    id: "forma-livre",
    title: "Forma livre",
    category: "Moda autoral",
    description: "Criadores independentes que reinventam formas, materiais e o jeito de vestir.",
    price: 48,
    issue: "Edição 12",
    cover: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85",
    coverTitle: "FORMA<br>LIVRE",
  },
  {
    id: "estilo-em-movimento",
    title: "Estilo em movimento",
    category: "Tendências",
    description: "Uma leitura do que está mudando nas passarelas, nas ruas e no nosso guarda-roupa.",
    price: 42,
    issue: "Edição 08",
    cover: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
    coverTitle: "ESTILO<br>EM MOV.",
  },
  {
    id: "rua-e-identidade",
    title: "Rua & identidade",
    category: "Streetwear",
    description: "A moda urbana como linguagem: pessoas, cenas e referências que criam movimento.",
    price: 54,
    issue: "Edição 05",
    cover: "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=85",
    coverTitle: "RUA &<br>IDENTIDADE",
  },
  {
    id: "ritual-de-beleza",
    title: "Ritual de beleza",
    category: "Beleza",
    description: "Beleza sem regras: autocuidado, expressão e novas conversas sobre imagem.",
    price: 46,
    issue: "Edição 03",
    cover: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=85",
    coverTitle: "RITUAL<br>DE BELEZA",
  },
  {
    id: "vestir-o-tempo",
    title: "Vestir o tempo",
    category: "Sustentabilidade",
    description: "Consumo consciente, peças duráveis e caminhos para uma moda com mais cuidado.",
    price: 39,
    issue: "Edição 07",
    cover: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    coverTitle: "VESTIR<br>O TEMPO",
  },
  {
    id: "arquivo-da-moda",
    title: "Arquivo da moda",
    category: "Moda autoral",
    description: "Ícones, movimentos e imagens que ajudam a entender como o estilo se transforma.",
    price: 44,
    issue: "Edição 02",
    cover: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
    coverTitle: "ARQUIVO<br>DA MODA",
  },
];
const sessions = new Map();
const loginAttempts = new Map();
let credentials;
let magazines;
let categories;
let catalogWriteQueue = Promise.resolve();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function isTrustedLocalOrigin(origin, hostHeader) {
  if (!origin || !hostHeader) return false;
  try {
    const parsedOrigin = new URL(origin);
    const requestHost = new URL(`http://${hostHeader}`);
    return parsedOrigin.protocol === "http:"
      && isLoopbackHostname(parsedOrigin.hostname)
      && parsedOrigin.hostname === requestHost.hostname;
  } catch {
    return false;
  }
}

function setSecurityHeaders(response, request) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob: https://images.unsplash.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; script-src 'self'; " +
    "connect-src 'self' http://localhost:* http://127.0.0.1:*; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  );
  const origin = request.headers.origin;
  if (isTrustedLocalOrigin(origin, request.headers.host)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Vary", "Origin");
  }
}

function publicMagazine(magazine) {
  return {
    id: magazine.id,
    title: magazine.title,
    category: magazine.category,
    description: magazine.description,
    price: magazine.price,
    issue: magazine.issue,
    cover: magazine.cover,
    coverTitle: magazine.coverTitle,
    position: "center",
  };
}

function validMagazineRecord(magazine, allowedCategories = magazineCategories) {
  let validCover = false;
  if (typeof magazine?.cover === "string" && magazine.cover.length <= maxCoverCharacters) {
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(magazine.cover)) {
      validCover = true;
    } else {
      try {
        const coverUrl = new URL(magazine.cover);
        validCover = coverUrl.protocol === "https:"
          && coverUrl.hostname === "images.unsplash.com";
      } catch {
        validCover = false;
      }
    }
  }
  return magazine
    && typeof magazine.id === "string"
    && /^[a-z0-9][a-z0-9-]{2,79}$/i.test(magazine.id)
    && typeof magazine.title === "string"
    && magazine.title.length > 0
    && magazine.title.length <= 60
    && allowedCategories.has(magazine.category)
    && typeof magazine.description === "string"
    && magazine.description.length > 0
    && magazine.description.length <= 180
    && Number.isFinite(magazine.price)
    && magazine.price > 0
    && magazine.price <= 1000000
    && validCover
    && typeof magazine.coverTitle === "string"
    && magazine.coverTitle.length <= 60
    && typeof magazine.issue === "string"
    && magazine.issue.length > 0
    && magazine.issue.length <= 30;
}

async function writeJsonAtomically(filePath, data) {
  await fs.mkdir(dataDirectory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(data), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporaryPath, filePath);
}

async function initializeCredentials() {
  try {
    const saved = JSON.parse(await fs.readFile(credentialsPath, "utf8"));
    if (
      !saved
      || typeof saved.username !== "string"
      || !/^[a-f0-9]{32}$/i.test(saved.salt)
      || !/^[a-f0-9]{128}$/i.test(saved.passwordHash)
      || typeof saved.mustChangePassword !== "boolean"
    ) {
      throw new Error("O arquivo de credenciais administrativas está inválido.");
    }
    return saved;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const username = process.env.ADMIN_INITIAL_USERNAME || "";
  const password = process.env.ADMIN_INITIAL_PASSWORD || "";
  if (!username || !password) {
    throw new Error("Primeiro acesso: execute start.ps1 para configurar o usuário ADM.");
  }
  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    throw new Error("O nome de usuário deve ter de 3 a 32 caracteres (letras, números, . _ -).");
  }
  if (password.length > 1024) throw new Error("A senha inicial é muito longa.");

  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(password, salt, passwordLength, scryptOptions);
  const initialCredentials = {
    username,
    salt: salt.toString("hex"),
    passwordHash: passwordHash.toString("hex"),
    mustChangePassword: password.length < 12,
  };
  await writeJsonAtomically(credentialsPath, initialCredentials);
  delete process.env.ADMIN_INITIAL_PASSWORD;
  delete process.env.ADMIN_INITIAL_USERNAME;
  console.log("Credenciais ADM iniciais preparadas. A senha nunca é exibida no terminal.");
  return initialCredentials;
}

function validCategories(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) return false;
  const ids = new Set();
  const names = new Set();
  return items.every((category) => {
    if (
      !category
      || typeof category.id !== "string"
      || !/^[a-z0-9][a-z0-9-]{2,79}$/i.test(category.id)
      || typeof category.name !== "string"
      || category.name.trim() !== category.name
      || category.name.length < 2
      || category.name.length > 40
    ) return false;
    const normalizedName = category.name.toLocaleLowerCase("pt-BR");
    if (ids.has(category.id) || names.has(normalizedName)) return false;
    ids.add(category.id);
    names.add(normalizedName);
    return true;
  });
}

async function loadLegacyMagazines() {
  try {
    const saved = JSON.parse(await fs.readFile(magazinesPath, "utf8"));
    if (!Array.isArray(saved) || saved.some((magazine) => !validMagazineRecord(magazine))) {
      throw new Error("O arquivo de revistas cadastradas está inválido.");
    }
    return [...defaultMagazines.map((magazine) => ({ ...magazine })), ...saved];
  } catch (error) {
    if (error.code === "ENOENT") return defaultMagazines.map((magazine) => ({ ...magazine }));
    throw error;
  }
}

async function loadCatalog() {
  try {
    const saved = JSON.parse(await fs.readFile(catalogPath, "utf8"));
    if (!saved || !validCategories(saved.categories)) {
      throw new Error("O arquivo de categorias está inválido.");
    }
    const allowedCategories = new Set(saved.categories.map((category) => category.name));
    if (
      !Array.isArray(saved.magazines)
      || saved.magazines.some((magazine) => !validMagazineRecord(magazine, allowedCategories))
      || new Set(saved.magazines.map((magazine) => magazine.id)).size !== saved.magazines.length
    ) {
      throw new Error("O arquivo de revistas cadastradas está inválido.");
    }
    return { categories: saved.categories, magazines: saved.magazines };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      categories: defaultCategories.map((category) => ({ ...category })),
      magazines: await loadLegacyMagazines(),
    };
  }
}

function mutateCatalog(mutator) {
  const operation = catalogWriteQueue.then(mutator);
  catalogWriteQueue = operation.catch(() => {});
  return operation;
}

async function persistCatalog(nextCategories, nextMagazines) {
  await writeJsonAtomically(catalogPath, {
    categories: nextCategories,
    magazines: nextMagazines,
  });
}

async function readJsonBody(request) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Envie os dados no formato JSON.");
  }

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxRequestBytes) throw new HttpError(413, "A solicitação excede o tamanho permitido.");
    chunks.push(chunk);
  }

  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("O corpo precisa ser um objeto JSON.");
    }
    return body;
  } catch {
    throw new HttpError(400, "Os dados enviados são inválidos.");
  }
}

function requestCookies(request) {
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
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `margem_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function currentSession(request) {
  const token = requestCookies(request).margem_session;
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, session };
}

function requireSession(request) {
  const current = currentSession(request);
  if (!current) throw new HttpError(401, "Entre novamente no Painel ADM.");
  return current;
}

function requireChangedPassword() {
  if (credentials.mustChangePassword) {
    throw new HttpError(403, "Troque a senha inicial antes de continuar.");
  }
}

function verifySameOrigin(request) {
  const origin = request.headers.origin;
  const hostHeader = request.headers.host;
  if (!isTrustedLocalOrigin(origin, hostHeader)) {
    throw new HttpError(403, "Origem da solicitação não autorizada.");
  }
  const fetchSite = request.headers["sec-fetch-site"];
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new HttpError(403, "Solicitação entre sites não autorizada.");
  }
}

function clientAddress(request) {
  return request.socket.remoteAddress || "unknown";
}

function checkLoginLimit(address) {
  const attempt = loginAttempts.get(address);
  if (!attempt) return;
  if (attempt.blockedUntil > Date.now()) {
    throw new HttpError(429, "Muitas tentativas. Aguarde 15 minutos para tentar novamente.");
  }
  if (Date.now() - attempt.windowStartedAt >= loginWindowMs) loginAttempts.delete(address);
}

function recordFailedLogin(address) {
  let attempt = loginAttempts.get(address);
  if (!attempt || Date.now() - attempt.windowStartedAt >= loginWindowMs) {
    attempt = { attempts: 0, windowStartedAt: Date.now(), blockedUntil: 0 };
  }
  attempt.attempts += 1;
  if (attempt.attempts >= maxLoginAttempts) attempt.blockedUntil = Date.now() + loginWindowMs;
  loginAttempts.set(address, attempt);
  return attempt.blockedUntil > Date.now();
}

async function passwordMatches(password) {
  const actual = await scrypt(password, Buffer.from(credentials.salt, "hex"), passwordLength, scryptOptions);
  const expected = Buffer.from(credentials.passwordHash, "hex");
  return crypto.timingSafeEqual(actual, expected);
}

function validateMagazine(body, existing = null) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const price = Number(body.price);
  if (!title || title.length > 60) throw new HttpError(400, "O título deve ter de 1 a 60 caracteres.");
  if (!magazineCategories.has(body.category)) throw new HttpError(400, "Escolha uma categoria válida.");
  if (!description || description.length > 180) throw new HttpError(400, "A descrição deve ter de 1 a 180 caracteres.");
  if (!Number.isFinite(price) || price <= 0 || price > 1000000) throw new HttpError(400, "Informe um preço válido.");
  const magazine = {
    id: existing ? existing.id : crypto.randomUUID(),
    title,
    category: body.category,
    description,
    price,
    issue: existing ? existing.issue : "Nova edição",
    cover: typeof body.cover === "string" ? body.cover : existing && existing.cover,
    coverTitle: title.toLocaleUpperCase("pt-BR"),
  };
  if (!validMagazineRecord(magazine)) {
    throw new HttpError(400, "Envie uma capa JPEG válida ou mantenha a capa atual.");
  }
  return magazine;
}

function validateCategory(body, existing = null) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 40) {
    throw new HttpError(400, "O nome da categoria deve ter de 2 a 40 caracteres.");
  }
  const duplicate = categories.some((category) =>
    category.id !== (existing && existing.id)
    && category.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"),
  );
  if (duplicate) throw new HttpError(409, "Já existe uma categoria com esse nome.");
  return { id: existing ? existing.id : crypto.randomUUID(), name };
}

function staticFile(response, fileName) {
  const fileTypes = {
    "index.html": "text/html; charset=utf-8",
    "app.js": "text/javascript; charset=utf-8",
    "style.css": "text/css; charset=utf-8",
  };
  const filePath = path.join(root, fileName);
  fs.readFile(filePath)
    .then((contents) => {
      response.writeHead(200, {
        "Content-Type": fileTypes[fileName],
        "Cache-Control": "no-store",
      });
      response.end(contents);
    })
    .catch((error) => {
      console.error(`Não foi possível servir ${fileName}.`, error);
      sendJson(response, 500, { error: "Não foi possível carregar a página." });
    });
}

async function handleRequest(request, response) {
  setSecurityHeaders(response, request);
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "OPTIONS") {
    if (!isTrustedLocalOrigin(request.headers.origin, request.headers.host)) {
      throw new HttpError(403, "Origem da solicitação não autorizada.");
    }
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    staticFile(response, "index.html");
    return;
  }
  if (request.method === "GET" && pathname === "/app.js") {
    staticFile(response, "app.js");
    return;
  }
  if (request.method === "GET" && pathname === "/style.css") {
    staticFile(response, "style.css");
    return;
  }
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { service: "margem-api", version: 1 });
    return;
  }
  if (request.method === "GET" && pathname === "/api/magazines") {
    sendJson(response, 200, magazines.map(publicMagazine));
    return;
  }
  if (request.method === "GET" && pathname === "/api/categories") {
    sendJson(response, 200, categories);
    return;
  }
  if (request.method === "GET" && pathname === "/api/auth/session") {
    const current = currentSession(request);
    sendJson(response, 200, current
      ? { authenticated: true, username: credentials.username, mustChangePassword: credentials.mustChangePassword }
      : { authenticated: false });
    return;
  }
  if (request.method === "POST" && pathname === "/api/auth/login") {
    verifySameOrigin(request);
    const address = clientAddress(request);
    checkLoginLimit(address);
    const body = await readJsonBody(request);
    const password = typeof body.password === "string" ? body.password : "";
    const usernameMatches = typeof body.username === "string" && body.username === credentials.username;
    const validPassword = await passwordMatches(password);
    if (!usernameMatches || !validPassword) {
      const locked = recordFailedLogin(address);
      throw new HttpError(locked ? 429 : 401, locked
        ? "Muitas tentativas. Aguarde 15 minutos para tentar novamente."
        : "Usuário ou senha incorretos.");
    }

    loginAttempts.delete(address);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, { expiresAt: Date.now() + sessionLifetimeMs });
    response.setHeader("Set-Cookie", sessionCookie(token, Math.floor(sessionLifetimeMs / 1000)));
    sendJson(response, 200, {
      authenticated: true,
      username: credentials.username,
      mustChangePassword: credentials.mustChangePassword,
    });
    return;
  }
  if (request.method === "POST" && pathname === "/api/auth/change-password") {
    verifySameOrigin(request);
    const current = requireSession(request);
    const body = await readJsonBody(request);
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
    const validCurrentPassword = await passwordMatches(currentPassword);
    if (!validCurrentPassword) throw new HttpError(401, "A senha atual está incorreta.");
    if (newPassword.length < 12 || newPassword.length > 1024) {
      throw new HttpError(400, "A nova senha precisa ter pelo menos 12 caracteres.");
    }
    if (newPassword === currentPassword) {
      throw new HttpError(400, "Escolha uma senha diferente da senha atual.");
    }

    const salt = crypto.randomBytes(16);
    const passwordHash = await scrypt(newPassword, salt, passwordLength, scryptOptions);
    const updatedCredentials = {
      username: credentials.username,
      salt: salt.toString("hex"),
      passwordHash: passwordHash.toString("hex"),
      mustChangePassword: false,
    };
    await writeJsonAtomically(credentialsPath, updatedCredentials);
    credentials = updatedCredentials;
    sessions.clear();
    sessions.set(current.token, { expiresAt: Date.now() + sessionLifetimeMs });
    response.setHeader("Set-Cookie", sessionCookie(current.token, Math.floor(sessionLifetimeMs / 1000)));
    sendJson(response, 200, { changed: true, mustChangePassword: false });
    return;
  }
  if (request.method === "POST" && pathname === "/api/auth/logout") {
    verifySameOrigin(request);
    const current = currentSession(request);
    if (current) sessions.delete(current.token);
    response.setHeader("Set-Cookie", sessionCookie("", 0));
    sendJson(response, 200, { loggedOut: true });
    return;
  }
  if (request.method === "POST" && pathname === "/api/magazines") {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    const body = await readJsonBody(request);
    const magazine = await mutateCatalog(async () => {
      const newMagazine = validateMagazine(body);
      const updatedMagazines = [...magazines, newMagazine];
      await persistCatalog(categories, updatedMagazines);
      magazines = updatedMagazines;
      return newMagazine;
    });
    sendJson(response, 201, { magazine: publicMagazine(magazine) });
    return;
  }
  const magazineMatch = pathname.match(/^\/api\/magazines\/([a-z0-9][a-z0-9-]{2,79})$/i);
  if (request.method === "PUT" && magazineMatch) {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    const body = await readJsonBody(request);
    const updatedMagazine = await mutateCatalog(async () => {
      const existing = magazines.find((magazine) => magazine.id === magazineMatch[1]);
      if (!existing) throw new HttpError(404, "Revista não encontrada.");
      const updated = validateMagazine(body, existing);
      const updatedMagazines = magazines.map((magazine) =>
        magazine.id === existing.id ? updated : magazine,
      );
      await persistCatalog(categories, updatedMagazines);
      magazines = updatedMagazines;
      return updated;
    });
    sendJson(response, 200, { magazine: publicMagazine(updatedMagazine) });
    return;
  }
  if (request.method === "POST" && pathname === "/api/categories") {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    const body = await readJsonBody(request);
    const category = await mutateCatalog(async () => {
      if (categories.length >= 50) throw new HttpError(409, "A loja já atingiu o limite de categorias.");
      const newCategory = validateCategory(body);
      const updatedCategories = [...categories, newCategory];
      await persistCatalog(updatedCategories, magazines);
      categories = updatedCategories;
      magazineCategories = new Set(categories.map((item) => item.name));
      return newCategory;
    });
    sendJson(response, 201, { category });
    return;
  }
  const categoryMatch = pathname.match(/^\/api\/categories\/([a-z0-9][a-z0-9-]{2,79})$/i);
  if (request.method === "PUT" && categoryMatch) {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    const body = await readJsonBody(request);
    const result = await mutateCatalog(async () => {
      const existing = categories.find((category) => category.id === categoryMatch[1]);
      if (!existing) throw new HttpError(404, "Categoria não encontrada.");
      const updatedCategory = validateCategory(body, existing);
      const updatedCategories = categories.map((category) =>
        category.id === existing.id ? updatedCategory : category,
      );
      const updatedMagazines = magazines.map((magazine) => (
        magazine.category === existing.name
          ? { ...magazine, category: updatedCategory.name }
          : magazine
      ));
      await persistCatalog(updatedCategories, updatedMagazines);
      categories = updatedCategories;
      magazines = updatedMagazines;
      magazineCategories = new Set(categories.map((item) => item.name));
      return { category: updatedCategory, magazines: updatedMagazines };
    });
    sendJson(response, 200, {
      category: result.category,
      magazines: result.magazines.map(publicMagazine),
    });
    return;
  }
  if (request.method === "DELETE" && categoryMatch) {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    await mutateCatalog(async () => {
      const category = categories.find((item) => item.id === categoryMatch[1]);
      if (!category) throw new HttpError(404, "Categoria não encontrada.");
      if (magazines.some((magazine) => magazine.category === category.name)) {
        throw new HttpError(409, "Mova as revistas para outra categoria antes de excluí-la.");
      }
      const updatedCategories = categories.filter((item) => item.id !== category.id);
      if (updatedCategories.length === 0) throw new HttpError(409, "A loja precisa ter ao menos uma categoria.");
      await persistCatalog(updatedCategories, magazines);
      categories = updatedCategories;
      magazineCategories = new Set(categories.map((item) => item.name));
    });
    sendJson(response, 200, { removed: true });
    return;
  }
  const deleteMagazineMatch = pathname.match(/^\/api\/magazines\/([a-z0-9][a-z0-9-]{2,79})$/i);
  if (request.method === "DELETE" && deleteMagazineMatch) {
    verifySameOrigin(request);
    requireSession(request);
    requireChangedPassword();
    const id = deleteMagazineMatch[1];
    await mutateCatalog(async () => {
      const updatedMagazines = magazines.filter((magazine) => magazine.id !== id);
      if (updatedMagazines.length === magazines.length) throw new HttpError(404, "Revista não encontrada.");
      await persistCatalog(categories, updatedMagazines);
      magazines = updatedMagazines;
    });
    sendJson(response, 200, { removed: true });
    return;
  }

  sendJson(response, 404, { error: "Página não encontrada." });
}

async function main() {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("A porta do servidor é inválida.");
  credentials = await initializeCredentials();
  const catalog = await loadCatalog();
  categories = catalog.categories;
  magazines = catalog.magazines;
  magazineCategories = new Set(categories.map((category) => category.name));

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      const status = error instanceof HttpError ? error.status : 500;
      if (status >= 500) console.error("Erro ao processar solicitação.", error);
      sendJson(response, status, { error: status === 500 ? "Erro interno do servidor." : error.message });
    });
  });

  server.listen(port, host, () => {
    console.log(`Servidor ADM disponível em http://localhost:${port}`);
    console.log("Agora você pode abrir index.html pelo Live Server do VS Code.");
    console.log(`Servidor escutando somente em ${host}.`);
  });
}

main().catch((error) => {
  console.error("Não foi possível iniciar o servidor da Margem.", error);
  process.exitCode = 1;
});
