const STORAGE_KEY = "public-wishlist-items";
const STATUS = {
  AVAILABLE: "available",
  RESERVED: "reserved",
  PURCHASED: "purchased",
};

// Локальная JSON-структура имитирует данные с сервера.
const DEFAULT_ITEMS = [
  {
    id: "gift-1",
    name: "Беспроводные наушники",
    description: "Накладные, с шумоподавлением. Цвет лучше черный или серебристый.",
    link: "https://example.com/headphones",
    price: "12 000 ₽",
    status: STATUS.AVAILABLE,
  },
  {
    id: "gift-2",
    name: "Книга по дизайну",
    description: "Красивое подарочное издание для домашней библиотеки.",
    link: "https://example.com/book",
    price: "3 500 ₽",
    status: STATUS.RESERVED,
  },
  {
    id: "gift-3",
    name: "Кофемолка",
    description: "Компактная электрическая кофемолка для зернового кофе.",
    link: "https://example.com/coffee-grinder",
    price: "6 900 ₽",
    status: STATUS.PURCHASED,
  },
];

const statusLabels = {
  [STATUS.AVAILABLE]: "Свободно",
  [STATUS.RESERVED]: "Занято",
  [STATUS.PURCHASED]: "Куплено",
};

const isAdmin = new URLSearchParams(window.location.search).get("admin") === "true";

const modeLabel = document.querySelector("#modeLabel");
const adminPanel = document.querySelector("#adminPanel");
const form = document.querySelector("#giftForm");
const nameInput = document.querySelector("#nameInput");
const descriptionInput = document.querySelector("#descriptionInput");
const linkInput = document.querySelector("#linkInput");
const priceInput = document.querySelector("#priceInput");
const wishlist = document.querySelector("#wishlist");
const emptyState = document.querySelector("#emptyState");
const itemCount = document.querySelector("#itemCount");
const exportButton = document.querySelector("#exportButton");
const importInput = document.querySelector("#importInput");

let items = loadItems();

init();

function init() {
  modeLabel.textContent = isAdmin ? "Режим владельца" : "Публичный режим";
  adminPanel.classList.toggle("hidden", !isAdmin);

  form.addEventListener("submit", addItem);
  exportButton.addEventListener("click", exportJson);
  importInput.addEventListener("change", importJson);

  renderItems();
}

// Загружаем сохраненные данные, иначе используем встроенный JSON.
function loadItems() {
  try {
    const savedItems = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(savedItems) ? normalizeItems(savedItems) : DEFAULT_ITEMS;
  } catch {
    return DEFAULT_ITEMS;
  }
}

// Сохраняем все изменения в localStorage.
function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function normalizeItems(rawItems) {
  return rawItems
    .filter((item) => item && item.name)
    .map((item) => ({
      id: item.id || createId(),
      name: String(item.name).trim(),
      description: item.description ? String(item.description).trim() : "",
      link: normalizeLink(item.link ? String(item.link).trim() : ""),
      price: item.price ? String(item.price).trim() : "",
      status: Object.values(STATUS).includes(item.status)
        ? item.status
        : STATUS.AVAILABLE,
    }));
}

function createId() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId || `${Date.now()}-${Math.random()}`;
}

function normalizeLink(link) {
  if (!link) {
    return "";
  }

  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function renderItems() {
  wishlist.innerHTML = "";
  emptyState.classList.toggle("visible", items.length === 0);
  itemCount.textContent = formatCount(items.length);

  items.forEach((item) => wishlist.append(createCard(item)));
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "gift-card";

  const cardTop = document.createElement("div");
  cardTop.className = "card-top";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = item.name;

  const status = document.createElement("span");
  status.className = `status ${item.status}`;
  status.textContent = statusLabels[item.status];

  cardTop.append(title, status);
  card.append(cardTop);

  if (item.description) {
    const description = document.createElement("p");
    description.className = "description";
    description.textContent = item.description;
    card.append(description);
  }

  const meta = createMeta(item);
  if (meta.children.length) {
    card.append(meta);
  }

  if (isAdmin) {
    card.append(createAdminControls(item));
  } else {
    card.append(createPublicActions(item));
  }

  return card;
}

function createMeta(item) {
  const meta = document.createElement("div");
  meta.className = "meta";

  if (item.price) {
    const price = document.createElement("span");
    price.textContent = item.price;
    meta.append(price);
  }

  if (item.link) {
    const link = document.createElement("a");
    link.href = item.link;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Открыть ссылку";
    meta.append(link);
  }

  return meta;
}

function createAdminControls(item) {
  const wrapper = document.createElement("div");
  wrapper.className = "admin-controls";

  const label = document.createElement("label");
  const labelText = document.createElement("span");
  labelText.textContent = "Статус";

  const select = document.createElement("select");
  select.value = item.status;

  Object.entries(statusLabels).forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.append(option);
  });

  select.addEventListener("change", () => updateStatus(item.id, select.value));
  label.append(labelText, select);

  const actions = document.createElement("div");
  actions.className = "actions";

  const deleteButton = document.createElement("button");
  deleteButton.className = "card-button delete";
  deleteButton.type = "button";
  deleteButton.textContent = "Удалить";
  deleteButton.addEventListener("click", () => deleteItem(item.id));

  actions.append(deleteButton);
  wrapper.append(label, actions);

  return wrapper;
}

function createPublicActions(item) {
  const actions = document.createElement("div");
  actions.className = "actions";

  if (item.status === STATUS.AVAILABLE) {
    const reserveButton = document.createElement("button");
    reserveButton.className = "card-button reserve";
    reserveButton.type = "button";
    reserveButton.textContent = "Забронировать";
    reserveButton.addEventListener("click", () => updateStatus(item.id, STATUS.RESERVED));
    actions.append(reserveButton);
  }

  if (item.status === STATUS.RESERVED) {
    const cancelButton = document.createElement("button");
    cancelButton.className = "card-button cancel";
    cancelButton.type = "button";
    cancelButton.textContent = "Отменить бронь";
    cancelButton.addEventListener("click", () => updateStatus(item.id, STATUS.AVAILABLE));
    actions.append(cancelButton);
  }

  return actions;
}

function addItem(event) {
  event.preventDefault();

  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  items = [
    {
      id: createId(),
      name,
      description: descriptionInput.value.trim(),
      link: normalizeLink(linkInput.value.trim()),
      price: priceInput.value.trim(),
      status: STATUS.AVAILABLE,
    },
    ...items,
  ];

  saveItems();
  renderItems();
  form.reset();
  nameInput.focus();
}

function updateStatus(id, status) {
  items = items.map((item) => (item.id === id ? { ...item, status } : item));
  saveItems();
  renderItems();
}

function deleteItem(id) {
  items = items.filter((item) => item.id !== id);
  saveItems();
  renderItems();
}

function exportJson() {
  const json = JSON.stringify(items, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "wishlist.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", () => {
    try {
      const importedItems = JSON.parse(reader.result);
      if (!Array.isArray(importedItems)) {
        throw new Error("JSON должен быть массивом подарков");
      }

      items = normalizeItems(importedItems);
      saveItems();
      renderItems();
    } catch (error) {
      alert(`Не удалось импортировать файл: ${error.message}`);
    } finally {
      importInput.value = "";
    }
  });

  reader.readAsText(file);
}

function formatCount(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${count} подарок`;
  }

  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return `${count} подарка`;
  }

  return `${count} подарков`;
}
