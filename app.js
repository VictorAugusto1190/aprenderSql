const whatsappNumber = "5514997615693";

let magazines = [
  {
    id: "forma-livre",
    title: "Forma livre",
    category: "Moda autoral",
    description:
      "Criadores independentes que reinventam formas, materiais e o jeito de vestir.",
    price: 48,
    issue: "Edição 12",
    cover:
      "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=85",
    coverTitle: "FORMA<br>LIVRE",
    position: "center",
  },
  {
    id: "estilo-em-movimento",
    title: "Estilo em movimento",
    category: "Tendências",
    description:
      "Uma leitura do que está mudando nas passarelas, nas ruas e no nosso guarda-roupa.",
    price: 42,
    issue: "Edição 08",
    cover:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=85",
    coverTitle: "ESTILO<br>EM MOV.",
    position: "center",
  },
  {
    id: "rua-e-identidade",
    title: "Rua & identidade",
    category: "Streetwear",
    description:
      "A moda urbana como linguagem: pessoas, cenas e referências que criam movimento.",
    price: 54,
    issue: "Edição 05",
    cover:
      "https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=800&q=85",
    coverTitle: "RUA &<br>IDENTIDADE",
    position: "center",
  },
  {
    id: "ritual-de-beleza",
    title: "Ritual de beleza",
    category: "Beleza",
    description:
      "Beleza sem regras: autocuidado, expressão e novas conversas sobre imagem.",
    price: 46,
    issue: "Edição 03",
    cover:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=800&q=85",
    coverTitle: "RITUAL<br>DE BELEZA",
    position: "center",
  },
  {
    id: "vestir-o-tempo",
    title: "Vestir o tempo",
    category: "Sustentabilidade",
    description:
      "Consumo consciente, peças duráveis e caminhos para uma moda com mais cuidado.",
    price: 39,
    issue: "Edição 07",
    cover:
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=85",
    coverTitle: "VESTIR<br>O TEMPO",
    position: "center",
  },
  {
    id: "arquivo-da-moda",
    title: "Arquivo da moda",
    category: "Moda autoral",
    description:
      "Ícones, movimentos e imagens que ajudam a entender como o estilo se transforma.",
    price: 44,
    issue: "Edição 02",
    cover:
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=85",
    coverTitle: "ARQUIVO<br>DA MODA",
    position: "center",
  },
];

let categories = [
  { id: "moda-autoral", name: "Moda autoral" },
  { id: "tendencias", name: "Tendências" },
  { id: "streetwear", name: "Streetwear" },
  { id: "beleza", name: "Beleza" },
  { id: "sustentabilidade", name: "Sustentabilidade" },
];
let catalogMagazines = [];
let editingMagazine = null;
let coverPreviewUrl = null;
const magazineGrid = document.querySelector("#magazineGrid");
const categoryList = document.querySelector("#categoryList");
const searchInput = document.querySelector("#searchInput");
const noResults = document.querySelector("#noResults");
let magazineCount = null;
const heroCount = document.querySelector("#heroCount");
const cartDrawer = document.querySelector("#cartDrawer");
const drawerBackdrop = document.querySelector("#drawerBackdrop");
const cartItems = document.querySelector("#cartItems");
const cartEmpty = document.querySelector("#cartEmpty");
const cartFooter = document.querySelector("#cartFooter");
const cartCount = document.querySelector("#cartCount");
const drawerCount = document.querySelector("#drawerCount");
const cartTotal = document.querySelector("#cartTotal");
const whatsappCheckout = document.querySelector("#whatsappCheckout");
const toast = document.querySelector("#toast");
const clientPanel = document.querySelector("#clientPanel");
const adminPanel = document.querySelector("#adminPanel");
const toggleAdmin = document.querySelector("#toggleAdmin");
const loginModal = document.querySelector("#adminLoginModal");
const loginForm = document.querySelector("#adminLoginForm");
const loginMessage = document.querySelector("#loginMessage");
const passwordForm = document.querySelector("#passwordForm");
const passwordMessage = document.querySelector("#passwordMessage");
const passwordChangeRequired = document.querySelector(
  "#passwordChangeRequired",
);
const changePasswordButton = document.querySelector("#changePasswordButton");
const magazineForm = document.querySelector("#magazineForm");
const coverFile = document.querySelector("#coverFile");
const coverPreview = document.querySelector("#coverPreview");
const previewImage = document.querySelector("#previewImage");
const uploadName = document.querySelector("#uploadName");
const adminMagazineList = document.querySelector("#adminMagazineList");
const adminMagazineCount = document.querySelector("#adminMagazineCount");
const adminEmpty = document.querySelector("#adminEmpty");
const submitMagazine = document.querySelector("#submitMagazine");
const cancelMagazineEdit = document.querySelector("#cancelMagazineEdit");
const magazineFormOverline = document.querySelector("#magazineFormOverline");
const magazineFormHeading = document.querySelector("#magazineFormHeading");
const categoryForm = document.querySelector("#categoryForm");
const categoryInput = document.querySelector("#categoryInput");
const categoryAdminList = document.querySelector("#categoryAdminList");
const categoryFormSubmit = document.querySelector("#categoryFormSubmit");
const cancelCategoryEdit = document.querySelector("#cancelCategoryEdit");

let selectedCategory = "Todas";
let editingCategory = null;
let isAdminAuthenticated = false;
let mustChangePassword = false;
let apiBaseUrl = null;
let apiBasePromise = null;
const cart = new Map();
const cartStorageKey = "margem-cart";
const apiPorts = Array.from({ length: 20 }, (_, index) => 4173 + index);

const formatPrice = (value) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const normalized = (value) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function renderMagazines() {
  const searchTerm = normalized(searchInput.value.trim());
  magazineCount.textContent = String(magazines.length).padStart(2, "0");
  heroCount.textContent = String(magazines.length).padStart(2, "0");
  const visibleMagazines = magazines.filter((magazine) => {
    const matchesCategory =
      selectedCategory === "Todas" || magazine.category === selectedCategory;
    const matchesSearch = normalized(
      `${magazine.title} ${magazine.category} ${magazine.description}`,
    ).includes(searchTerm);
    return matchesCategory && matchesSearch;
  });

  magazineGrid.replaceChildren();
  noResults.hidden = visibleMagazines.length > 0;

  visibleMagazines.forEach((magazine, index) => {
    const card = document.createElement("article");
    card.className = "magazine-card";
    card.style.animationDelay = `${index * 45}ms`;
    const cover = document.createElement("div");
    cover.className = "magazine-cover";
    const image = document.createElement("img");
    image.src = magazine.cover;
    image.alt = `Capa da revista ${magazine.title}`;
    image.loading = "lazy";
    image.style.objectPosition = magazine.position || "center";
    const type = document.createElement("span");
    type.className = "cover-type";
    type.textContent = `WORLD BOOKS / ${magazine.category.toUpperCase()}`;
    const issue = document.createElement("span");
    issue.className = "cover-issue";
    issue.textContent = magazine.issue.toUpperCase();
    const coverName = document.createElement("strong");
    coverName.className = "cover-name";
    coverName.textContent = magazine.coverTitle.replace(/<br\s*\/?>/gi, " ");
    cover.append(image, type, issue, coverName);

    const info = document.createElement("div");
    info.className = "card-info";
    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.append(
      createElement("span", "", magazine.category),
      createElement("span", "", magazine.issue),
    );
    const title = createElement("h3", "", magazine.title);
    const description = createElement("p", "", magazine.description);
    const buy = document.createElement("div");
    buy.className = "card-buy";
    const price = createElement(
      "span",
      "card-price",
      formatPrice(magazine.price),
    );
    const addButton = document.createElement("button");
    addButton.className = "add-button";
    addButton.type = "button";
    addButton.dataset.add = magazine.id;
    addButton.append("Adicionar ", createElement("span", "", "+"));
    buy.append(price, addButton);
    info.append(meta, title, description, buy);
    card.append(cover, info);
    magazineGrid.append(card);
  });
}

function renderCategoryControls() {
  if (
    selectedCategory !== "Todas" &&
    !categories.some((category) => category.name === selectedCategory)
  ) {
    selectedCategory = "Todas";
  }
  categoryList.replaceChildren();
  const allCategoriesButton = createElement(
    "button",
    "category-chip",
    "Todas ",
  );
  allCategoriesButton.type = "button";
  allCategoriesButton.dataset.category = "Todas";
  allCategoriesButton.classList.toggle("active", selectedCategory === "Todas");
  magazineCount = createElement(
    "span",
    "",
    String(magazines.length).padStart(2, "0"),
  );
  magazineCount.id = "magazineCount";
  allCategoriesButton.append(magazineCount);
  categoryList.append(allCategoriesButton);
  categories.forEach((category) => {
    const button = createElement("button", "category-chip", category.name);
    button.type = "button";
    button.dataset.category = category.name;
    button.classList.toggle("active", selectedCategory === category.name);
    categoryList.append(button);
  });

  const categorySelect = magazineForm.elements.category;
  const previousSelection = categorySelect.value;
  categorySelect.replaceChildren();
  categories.forEach((category) => {
    const option = createElement("option", "", category.name);
    option.value = category.name;
    categorySelect.append(option);
  });
  if (categories.some((category) => category.name === previousSelection)) {
    categorySelect.value = previousSelection;
  }
}

function renderAdminCategoryList() {
  categoryAdminList.replaceChildren();
  categories.forEach((category) => {
    const row = createElement("article", "admin-category-row");
    const name = createElement("strong", "", category.name);
    const actions = createElement("div", "admin-magazine-actions");
    const editButton = createElement("button", "admin-edit", "Editar");
    editButton.type = "button";
    editButton.dataset.editCategory = category.id;
    editButton.disabled = mustChangePassword;
    editButton.setAttribute("aria-label", `Editar categoria ${category.name}`);
    const deleteButton = createElement("button", "admin-remove", "Excluir");
    deleteButton.type = "button";
    deleteButton.dataset.deleteCategory = category.id;
    deleteButton.disabled = mustChangePassword;
    deleteButton.setAttribute(
      "aria-label",
      `Excluir categoria ${category.name}`,
    );
    actions.append(editButton, deleteButton);
    row.append(name, actions);
    categoryAdminList.append(row);
  });
}

function restoreCart() {
  let serialized;
  try {
    serialized = localStorage.getItem(cartStorageKey);
  } catch (error) {
    console.error(
      "Não foi possível acessar a sacola salva neste navegador.",
      error,
    );
    showToast("Não foi possível carregar a sacola salva.");
    return;
  }
  if (!serialized) return;

  try {
    const savedItems = JSON.parse(serialized);
    if (
      !Array.isArray(savedItems) ||
      savedItems.some(
        (item) =>
          !item ||
          typeof item.id !== "string" ||
          !/^[a-z0-9][a-z0-9-]{2,79}$/i.test(item.id) ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 99,
      )
    )
      throw new Error("Os dados salvos da sacola são inválidos.");
    savedItems.forEach(({ id, quantity }) => cart.set(id, quantity));
  } catch (error) {
    console.error("Não foi possível restaurar a sacola salva.", error);
    try {
      localStorage.removeItem(cartStorageKey);
    } catch (storageError) {
      console.error(
        "Não foi possível limpar os dados inválidos da sacola.",
        storageError,
      );
    }
    showToast("A sacola salva estava inválida e foi limpa.");
  }
}

function persistCart() {
  try {
    if (cart.size === 0) localStorage.removeItem(cartStorageKey);
    else {
      const savedItems = [...cart].map(([id, quantity]) => ({ id, quantity }));
      localStorage.setItem(cartStorageKey, JSON.stringify(savedItems));
    }
  } catch (error) {
    console.error("Não foi possível salvar a sacola neste navegador.", error);
    showToast(
      "Não foi possível salvar a sacola. Verifique o espaço do navegador.",
    );
  }
}

function openCart() {
  cartDrawer.classList.add("open");
  drawerBackdrop.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
  document.querySelector("#closeCart").focus();
}

function closeCart() {
  cartDrawer.classList.remove("open");
  drawerBackdrop.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(
    () => toast.classList.remove("show"),
    2200,
  );
}

function animateCoverToCart(button) {
  const cover = button
    .closest(".magazine-card")
    .querySelector(".magazine-cover img");
  const cartButton = document.querySelector("#openCart");
  const coverRect = cover.getBoundingClientRect();
  const cartRect = cartButton.getBoundingClientRect();
  const deltaX =
    cartRect.left + cartRect.width / 2 - (coverRect.left + coverRect.width / 2);
  const deltaY =
    cartRect.top + cartRect.height / 2 - (coverRect.top + coverRect.height / 2);
  const flyer = cover.cloneNode();

  flyer.classList.add("cart-flyer");
  flyer.setAttribute("aria-hidden", "true");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${coverRect.left}px`,
    top: `${coverRect.top}px`,
    width: `${coverRect.width}px`,
    height: `${coverRect.height}px`,
    margin: "0",
    zIndex: "1000",
    objectFit: "cover",
    pointerEvents: "none",
    transformOrigin: "center",
    boxShadow: "0 18px 40px rgba(0, 0, 0, .35)",
  });
  document.body.append(flyer);

  const animation = flyer.animate(
    [
      { transform: "translate(0, 0) scale(1) rotate(0)", opacity: 1 },
      {
        transform: `translate(${deltaX * 0.48}px, ${deltaY * 0.48 - 72}px) scale(.62) rotate(-7deg)`,
        opacity: 1,
        offset: 0.58,
      },
      {
        transform: `translate(${deltaX}px, ${deltaY}px) scale(.08) rotate(12deg)`,
        opacity: 0.25,
      },
    ],
    {
      duration: 720,
      easing: "cubic-bezier(.2, .72, .24, 1)",
    },
  );
  animation.addEventListener("finish", () => flyer.remove(), { once: true });
}

function pulseCartCount() {
  cartCount.classList.remove("bump");
  void cartCount.offsetWidth;
  cartCount.classList.add("bump");
}

function splashCart() {
  const cartButton = document.querySelector("#openCart");
  const splash = document.querySelector("#cartSplash");
  cartButton.classList.remove("splashing");
  splash.classList.remove("play");
  void cartButton.offsetWidth;
  cartButton.classList.add("splashing");
  splash.classList.add("play");

  window.clearTimeout(splashCart.timeout);
  splashCart.timeout = window.setTimeout(() => {
    cartButton.classList.remove("splashing");
    splash.classList.remove("play");
  }, 750);
}

async function discoverApiBaseUrl() {
  if (apiBaseUrl !== null) return apiBaseUrl;
  if (apiBasePromise) return apiBasePromise;
  apiBasePromise = (async () => {
    const hostname = location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const findApi = async (origin) => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 500);
      try {
        const response = await fetch(`${origin}/api/health`, {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        if (
          !response.ok
          || !(response.headers.get("content-type") || "").toLowerCase().includes("application/json")
        ) return null;
        const health = await response.json();
        return health.service === "margem-api" && health.version === 1;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timeout);
      }
    };

    if (!isLocalhost) {
      if (location.protocol !== "https:") {
        throw new Error("O site publicado precisa ser aberto por HTTPS para usar o painel ADM.");
      }
      if (!await findApi("")) throw new Error("A API do site ainda não está configurada no Vercel.");
      apiBaseUrl = "";
      return apiBaseUrl;
    }
    if (location.protocol !== "http:") {
      throw new Error("Abra o site pelo Live Server em localhost ou execute start.ps1.");
    }
    if (await findApi("")) {
      apiBaseUrl = "";
      return apiBaseUrl;
    }

    const origins = apiPorts.map((port) => `http://${hostname}:${port}`);
    const matches = await Promise.all(origins.map(async (origin) =>
      await findApi(origin) ? origin : null,
    ));
    apiBaseUrl = matches.find((origin) => origin !== null) || null;
    if (!apiBaseUrl) {
      throw new Error(
        "Não encontrei o servidor ADM nas portas locais. Execute start.ps1 e deixe-o aberto.",
      );
    }
    return apiBaseUrl;
  })();
  try {
    return await apiBasePromise;
  } finally {
    apiBasePromise = null;
  }
}

async function apiRequest(url, options = {}) {
  const apiOrigin = await discoverApiBaseUrl();
  let response;
  try {
    response = await fetch(`${apiOrigin}${url}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error(
      location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "Não foi possível conectar ao servidor. Inicie o site com start.ps1."
        : "Não foi possível conectar à API publicada. Verifique a implantação no Vercel.",
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "O servidor do ADM não respondeu à API. Feche outras versões do site, execute start.ps1 e abra http://localhost:4173."
        : "A API do ADM não respondeu em JSON. Confira as rotas e a implantação no Vercel.",
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("O servidor retornou uma resposta inválida.");
  }
  if (!response.ok)
    throw new Error(data.error || "A solicitação não foi concluída.");
  return data;
}

async function initializeServerData() {
  try {
    const [savedMagazines, savedCategories, session] = await Promise.all([
      apiRequest("/api/magazines"),
      apiRequest("/api/categories"),
      apiRequest("/api/auth/session"),
    ]);
    catalogMagazines = savedMagazines;
    magazines = [...catalogMagazines];
    categories = savedCategories;
    isAdminAuthenticated = session.authenticated;
    mustChangePassword = Boolean(session.mustChangePassword);
    for (const id of cart.keys()) {
      if (!magazines.some((magazine) => magazine.id === id)) cart.delete(id);
    }
    persistCart();
    renderCategoryControls();
    renderMagazines();
    renderAdminMagazineList();
    renderAdminCategoryList();
    renderCart();
  } catch (error) {
    console.error("Não foi possível carregar os dados do servidor.", error);
    showToast(error.message || "Não foi possível carregar o catálogo.");
  }
}

function updateAdminAccess() {
  passwordChangeRequired.hidden = !mustChangePassword;
  magazineForm
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      control.disabled = mustChangePassword;
    });
  categoryForm.querySelectorAll("input, button").forEach((control) => {
    control.disabled = mustChangePassword;
  });
  renderAdminMagazineList();
  renderAdminCategoryList();
}

function showLogin() {
  if (location.protocol === "file:") {
    showToast("Inicie o site pelo arquivo start.ps1 para entrar no ADM.");
    return;
  }
  loginMessage.hidden = true;
  loginMessage.textContent = "";
  loginModal.hidden = false;
  loginForm.elements.username.focus();
}

async function openAdmin() {
  if (location.protocol === "file:") {
    showLogin();
    return;
  }
  try {
    const session = await apiRequest("/api/auth/session");
    isAdminAuthenticated = session.authenticated;
    mustChangePassword = Boolean(session.mustChangePassword);
    if (isAdminAuthenticated) setAdminMode(true);
    else showLogin();
  } catch (error) {
    showToast(error.message || "Não foi possível conectar ao servidor.");
  }
}

function hideLogin() {
  loginModal.hidden = true;
  loginForm.reset();
  loginMessage.hidden = true;
}

function renderAdminMagazineList() {
  adminMagazineList.replaceChildren();
  adminMagazineCount.textContent = String(catalogMagazines.length).padStart(
    2,
    "0",
  );
  adminEmpty.hidden = catalogMagazines.length > 0;

  catalogMagazines.forEach((magazine) => {
    const row = createElement("article", "admin-magazine-row");
    const image = document.createElement("img");
    image.src = magazine.cover;
    image.alt = `Capa da revista ${magazine.title}`;
    const details = createElement("div", "admin-magazine-details");
    details.append(
      createElement("small", "", magazine.category),
      createElement("strong", "", magazine.title),
      createElement("span", "", formatPrice(magazine.price)),
    );
    const actions = createElement("div", "admin-magazine-actions");
    const editButton = createElement("button", "admin-edit", "Editar");
    editButton.type = "button";
    editButton.dataset.editMagazine = magazine.id;
    editButton.disabled = mustChangePassword;
    editButton.setAttribute("aria-label", `Editar ${magazine.title}`);
    const removeButton = createElement("button", "admin-remove", "Excluir");
    removeButton.type = "button";
    removeButton.dataset.deleteMagazine = magazine.id;
    removeButton.disabled = mustChangePassword;
    removeButton.setAttribute("aria-label", `Excluir ${magazine.title}`);
    actions.append(editButton, removeButton);
    row.append(image, details, actions);
    adminMagazineList.append(row);
  });
}

function clearCoverPreview() {
  if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
  coverPreviewUrl = null;
  previewImage.removeAttribute("src");
  coverPreview.hidden = true;
  uploadName.textContent = "JPG, PNG ou WEBP";
}

function resetMagazineForm() {
  editingMagazine = null;
  magazineForm.reset();
  clearCoverPreview();
  coverFile.required = true;
  magazineFormOverline.textContent = "Nova publicação";
  magazineFormHeading.textContent = "Dados da revista";
  submitMagazine.innerHTML =
    'Cadastrar revista <span aria-hidden="true">↗</span>';
  cancelMagazineEdit.hidden = true;
}

function startMagazineEdit(magazine) {
  editingMagazine = magazine;
  magazineForm.elements.title.value = magazine.title;
  magazineForm.elements.category.value = magazine.category;
  magazineForm.elements.price.value = magazine.price;
  magazineForm.elements.description.value = magazine.description;
  coverFile.value = "";
  coverFile.required = false;
  clearCoverPreview();
  previewImage.src = magazine.cover;
  coverPreview.hidden = false;
  uploadName.textContent = "Manter capa atual";
  magazineFormOverline.textContent = "Editar publicação";
  magazineFormHeading.textContent = magazine.title;
  submitMagazine.innerHTML =
    'Salvar alterações <span aria-hidden="true">↗</span>';
  cancelMagazineEdit.hidden = false;
  magazineForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function compressCover(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem válido.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("A imagem deve ter no máximo 12 MB.");
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () =>
        reject(new Error("Não foi possível abrir esta imagem."));
      image.src = imageUrl;
    });

    const scale = Math.min(
      1,
      1200 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Não foi possível preparar a imagem da capa.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function setAdminMode(isAdmin) {
  if (isAdmin && !isAdminAuthenticated) {
    showLogin();
    return;
  }
  adminPanel.hidden = !isAdmin;
  clientPanel.hidden = isAdmin;
  document.body.classList.toggle("admin-mode", isAdmin);
  toggleAdmin.textContent = isAdmin ? "Voltar à loja" : "Painel ADM";
  toggleAdmin.setAttribute("aria-pressed", String(isAdmin));
  if (isAdmin) updateAdminAccess();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function buildWhatsAppMessage(items, total) {
  const lines = items.map(
    ({ magazine, quantity }) =>
      `• ${magazine.title} — ${quantity} un. — ${formatPrice(magazine.price * quantity)}`,
  );
  return [
    "Olá! Quero fazer este pedido pela World Books:",
    "",
    ...lines,
    "",
    `Subtotal: ${formatPrice(total)}`,
    "",
    "Pode me confirmar a disponibilidade e as opções de pagamento?",
  ].join("\n");
}

function renderCart() {
  const items = [...cart.entries()]
    .map(([id, quantity]) => ({
      magazine: magazines.find((magazine) => magazine.id === id),
      quantity,
    }))
    .filter((item) => item.magazine);
  const quantityTotal = items.reduce((total, item) => total + item.quantity, 0);
  const priceTotal = items.reduce(
    (total, item) => total + item.magazine.price * item.quantity,
    0,
  );

  cartCount.textContent = quantityTotal;
  drawerCount.textContent = `(${quantityTotal})`;
  cartEmpty.hidden = items.length > 0;
  cartFooter.hidden = items.length === 0;
  cartItems.replaceChildren();

  items.forEach(({ magazine, quantity }) => {
    const row = document.createElement("div");
    row.className = "cart-row";
    const image = document.createElement("img");
    image.src = magazine.cover;
    image.alt = "";
    const info = createElement("div", "cart-row-info");
    info.append(
      createElement("small", "", magazine.category),
      createElement("strong", "", magazine.title),
      createElement(
        "span",
        "line-price",
        formatPrice(magazine.price * quantity),
      ),
    );
    const quantityControl = createElement("div", "quantity-control");
    [-1, 1].forEach((amount) => {
      const button = createElement("button", "", amount < 0 ? "−" : "+");
      button.type = "button";
      button.dataset.quantity = String(amount);
      button.dataset.id = magazine.id;
      button.setAttribute(
        "aria-label",
        amount < 0 ? "Diminuir quantidade" : "Aumentar quantidade",
      );
      if (amount < 0) quantityControl.append(button);
      else {
        quantityControl.append(
          createElement("span", "", String(quantity)),
          button,
        );
      }
    });
    info.append(quantityControl);
    const removeButton = createElement("button", "remove-item", "×");
    removeButton.type = "button";
    removeButton.dataset.remove = magazine.id;
    removeButton.setAttribute("aria-label", `Remover ${magazine.title}`);
    row.append(image, info, removeButton);
    cartItems.append(row);
  });

  cartTotal.textContent = formatPrice(priceTotal);
  const message = buildWhatsAppMessage(items, priceTotal);
  whatsappCheckout.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

categoryList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  categoryList.querySelector(".active").classList.remove("active");
  button.classList.add("active");
  renderMagazines();
});

searchInput.addEventListener("input", renderMagazines);

magazineGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const magazine = magazines.find((item) => item.id === button.dataset.add);
  const quantity = cart.get(magazine.id) || 0;
  if (quantity >= 99) {
    showToast("O limite por revista é de 99 unidades.");
    return;
  }
  animateCoverToCart(button);
  cart.set(magazine.id, quantity + 1);
  persistCart();
  renderCart();
  pulseCartCount();
  splashCart();
  showToast(`${magazine.title} adicionada · confira sua sacola`);
});

cartItems.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  if (removeButton) {
    cart.delete(removeButton.dataset.remove);
    persistCart();
    renderCart();
    return;
  }

  const quantityButton = event.target.closest("[data-quantity]");
  if (!quantityButton) return;
  const id = quantityButton.dataset.id;
  const quantity =
    (cart.get(id) || 0) + Number(quantityButton.dataset.quantity);
  if (quantity > 99) {
    showToast("O limite por revista é de 99 unidades.");
    return;
  }
  if (quantity <= 0) cart.delete(id);
  else cart.set(id, quantity);
  persistCart();
  renderCart();
});

coverFile.addEventListener("change", () => {
  const file = coverFile.files[0];
  if (!file) {
    if (editingMagazine) {
      previewImage.src = editingMagazine.cover;
      coverPreview.hidden = false;
      uploadName.textContent = "Manter capa atual";
    } else {
      clearCoverPreview();
    }
    return;
  }
  if (!file.type.startsWith("image/")) {
    coverFile.value = "";
    clearCoverPreview();
    showToast("Selecione um arquivo de imagem.");
    return;
  }
  if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
  coverPreviewUrl = URL.createObjectURL(file);
  previewImage.src = coverPreviewUrl;
  coverPreview.hidden = false;
  uploadName.textContent = file.name;
});

magazineForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitMagazine.disabled = true;
  submitMagazine.textContent = "Preparando capa...";

  try {
    const data = new FormData(magazineForm);
    const isEditing = Boolean(editingMagazine);
    const title = data.get("title").trim();
    const description = data.get("description").trim();
    const price = Number(data.get("price"));
    if (!title || !description || !Number.isFinite(price) || price <= 0) {
      throw new Error("Preencha título, descrição e um preço válido.");
    }

    const selectedCover = data.get("cover");
    const cover =
      selectedCover && selectedCover.size
        ? await compressCover(selectedCover)
        : editingMagazine && editingMagazine.cover;
    if (!cover) throw new Error("Escolha uma imagem para a capa.");
    const payload = {
      title,
      category: data.get("category"),
      description,
      price,
      cover,
    };
    const { magazine } = await apiRequest(
      isEditing
        ? `/api/magazines/${encodeURIComponent(editingMagazine.id)}`
        : "/api/magazines",
      {
        method: isEditing ? "PUT" : "POST",
        body: payload,
      },
    );
    catalogMagazines = isEditing
      ? catalogMagazines.map((item) =>
          item.id === magazine.id ? magazine : item,
        )
      : [...catalogMagazines, magazine];
    magazines = [...catalogMagazines];
    resetMagazineForm();
    renderMagazines();
    renderAdminMagazineList();
    showToast(
      isEditing
        ? "Revista atualizada na loja."
        : "Revista cadastrada e publicada na loja.",
    );
  } catch (error) {
    console.error("Não foi possível salvar esta revista.", error);
    showToast(error.message || "Não foi possível salvar esta revista.");
  } finally {
    submitMagazine.disabled = mustChangePassword;
    submitMagazine.innerHTML = editingMagazine
      ? 'Salvar alterações <span aria-hidden="true">↗</span>'
      : 'Cadastrar revista <span aria-hidden="true">↗</span>';
  }
});

cancelMagazineEdit.addEventListener("click", resetMagazineForm);

function resetCategoryForm() {
  editingCategory = null;
  categoryForm.reset();
  categoryFormSubmit.textContent = "Adicionar categoria";
  cancelCategoryEdit.hidden = true;
}

function startCategoryEdit(category) {
  editingCategory = category;
  categoryInput.value = category.name;
  categoryFormSubmit.textContent = "Salvar categoria";
  cancelCategoryEdit.hidden = false;
  categoryInput.focus();
}

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = categoryInput.value.trim();
  if (name.length < 2 || name.length > 40) {
    showToast("O nome da categoria deve ter de 2 a 40 caracteres.");
    return;
  }

  const isEditing = Boolean(editingCategory);
  categoryFormSubmit.disabled = true;
  try {
    const result = await apiRequest(
      isEditing
        ? `/api/categories/${encodeURIComponent(editingCategory.id)}`
        : "/api/categories",
      {
        method: isEditing ? "PUT" : "POST",
        body: { name },
      },
    );
    if (isEditing) {
      categories = categories.map((item) =>
        item.id === result.category.id ? result.category : item,
      );
      catalogMagazines = result.magazines;
      magazines = [...catalogMagazines];
      if (selectedCategory === editingCategory.name)
        selectedCategory = result.category.name;
      if (editingMagazine) {
        editingMagazine = catalogMagazines.find(
          (item) => item.id === editingMagazine.id,
        ) || editingMagazine;
      }
    } else {
      categories = [...categories, result.category];
    }
    resetCategoryForm();
    renderCategoryControls();
    if (editingMagazine) magazineForm.elements.category.value = editingMagazine.category;
    renderAdminCategoryList();
    renderMagazines();
    renderAdminMagazineList();
    showToast(isEditing ? "Categoria atualizada." : "Categoria adicionada.");
  } catch (error) {
    console.error("Não foi possível salvar a categoria.", error);
    showToast(error.message || "Não foi possível salvar a categoria.");
  } finally {
    categoryFormSubmit.disabled = mustChangePassword;
  }
});

cancelCategoryEdit.addEventListener("click", resetCategoryForm);

categoryAdminList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-category]");
  if (editButton) {
    const category = categories.find(
      (item) => item.id === editButton.dataset.editCategory,
    );
    if (category) startCategoryEdit(category);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-category]");
  if (!deleteButton) return;
  const category = categories.find(
    (item) => item.id === deleteButton.dataset.deleteCategory,
  );
  if (!category || !window.confirm(`Excluir a categoria "${category.name}"?`))
    return;

  try {
    await apiRequest(`/api/categories/${encodeURIComponent(category.id)}`, {
      method: "DELETE",
    });
    categories = categories.filter((item) => item.id !== category.id);
    if (editingCategory && editingCategory.id === category.id)
      resetCategoryForm();
    renderCategoryControls();
    renderAdminCategoryList();
    renderMagazines();
    showToast("Categoria excluída.");
  } catch (error) {
    console.error("Não foi possível excluir a categoria.", error);
    showToast(error.message || "Não foi possível excluir a categoria.");
  }
});

adminMagazineList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-magazine]");
  if (editButton) {
    const magazine = catalogMagazines.find(
      (item) => item.id === editButton.dataset.editMagazine,
    );
    if (magazine) startMagazineEdit(magazine);
    return;
  }

  const removeButton = event.target.closest("[data-delete-magazine]");
  if (!removeButton) return;
  const id = removeButton.dataset.deleteMagazine;
  const magazine = catalogMagazines.find((item) => item.id === id);
  if (!magazine || !window.confirm(`Excluir a revista "${magazine.title}"?`))
    return;

  try {
    await apiRequest(`/api/magazines/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    catalogMagazines = catalogMagazines.filter((item) => item.id !== id);
    magazines = [...catalogMagazines];
    if (editingMagazine && editingMagazine.id === id) resetMagazineForm();
    cart.delete(id);
    persistCart();
    renderMagazines();
    renderCart();
    renderAdminMagazineList();
    showToast("Revista excluída da loja.");
  } catch (error) {
    console.error("Não foi possível excluir esta revista.", error);
    showToast(error.message || "Não foi possível excluir esta revista.");
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#loginButton");
  button.disabled = true;
  loginMessage.hidden = true;

  try {
    const data = new FormData(loginForm);
    const session = await apiRequest("/api/auth/login", {
      method: "POST",
      body: {
        username: data.get("username"),
        password: data.get("password"),
      },
    });
    isAdminAuthenticated = session.authenticated;
    mustChangePassword = Boolean(session.mustChangePassword);
    hideLogin();
    setAdminMode(true);
  } catch (error) {
    loginMessage.textContent = error.message || "Não foi possível entrar.";
    loginMessage.hidden = false;
  } finally {
    button.disabled = false;
  }
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = changePasswordButton;
  button.disabled = true;
  passwordMessage.hidden = true;

  try {
    const data = new FormData(passwordForm);
    const currentPassword = data.get("currentPassword");
    const newPassword = data.get("newPassword");
    const confirmation = data.get("confirmPassword");
    if (newPassword !== confirmation)
      throw new Error("A confirmação da nova senha não corresponde.");
    if (newPassword.length < 12)
      throw new Error("A nova senha precisa ter pelo menos 12 caracteres.");

    await apiRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    });
    mustChangePassword = false;
    passwordForm.reset();
    updateAdminAccess();
    passwordMessage.textContent =
      "Senha alterada. O cadastro de revistas está liberado.";
    passwordMessage.hidden = false;
    showToast("Senha alterada com sucesso.");
  } catch (error) {
    passwordMessage.textContent =
      error.message || "Não foi possível alterar a senha.";
    passwordMessage.hidden = false;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logoutAdmin").addEventListener("click", async () => {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" });
    isAdminAuthenticated = false;
    mustChangePassword = false;
    passwordForm.reset();
    passwordMessage.hidden = true;
    setAdminMode(false);
    showToast("Sessão ADM encerrada.");
  } catch (error) {
    console.error("Não foi possível encerrar a sessão administrativa.", error);
    showToast(error.message || "Não foi possível sair do Painel ADM.");
  }
});

toggleAdmin.addEventListener("click", () => {
  if (!adminPanel.hidden) {
    setAdminMode(false);
    return;
  }
  openAdmin();
});
document
  .querySelector("#backToStore")
  .addEventListener("click", () => setAdminMode(false));
document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    if (!adminPanel.hidden) setAdminMode(false);
  });
});
document.querySelector("#closeLogin").addEventListener("click", hideLogin);
loginModal.addEventListener("click", (event) => {
  if (event.target === loginModal) hideLogin();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    hideLogin();
  }
});

document.querySelector("#openCart").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
document.querySelector("#backToShop").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);

restoreCart();
renderCategoryControls();
renderMagazines();
renderAdminMagazineList();
renderAdminCategoryList();
renderCart();
initializeServerData();
