const STORAGE_KEY = "wishlist-items";

const form = document.querySelector("#wishForm");
const titleInput = document.querySelector("#titleInput");
const descriptionInput = document.querySelector("#descriptionInput");
const linkInput = document.querySelector("#linkInput");
const priceInput = document.querySelector("#priceInput");
const wishlist = document.querySelector("#wishlist");
const emptyState = document.querySelector("#emptyState");
const itemCount = document.querySelector("#itemCount");

let items = loadItems();

// Read saved items once on startup. Invalid data falls back to an empty list.
function loadItems() {
  try {
    const storedItems = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(storedItems) ? storedItems : [];
  } catch {
    return [];
  }
}

// Keep localStorage as the single persistent source for the app.
function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function createItem({ title, description, link, price }) {
  const randomId = globalThis.crypto?.randomUUID?.();

  return {
    id: randomId || `${Date.now()}-${Math.random()}`,
    title,
    description,
    link,
    price,
    reserved: false,
    createdAt: Date.now(),
  };
}

function formatCount(count) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

function normalizeLink(link) {
  if (!link) {
    return "";
  }

  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function renderItems() {
  wishlist.innerHTML = "";

  const hasItems = items.length > 0;
  emptyState.classList.toggle("visible", !hasItems);
  itemCount.textContent = formatCount(items.length);

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `wish-card${item.reserved ? " reserved" : ""}`;

    const cardTop = document.createElement("div");
    cardTop.className = "card-top";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.title;
    cardTop.append(title);

    if (item.reserved) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Reserved";
      cardTop.append(badge);
    }

    card.append(cardTop);

    if (item.description) {
      const description = document.createElement("p");
      description.className = "description";
      description.textContent = item.description;
      card.append(description);
    }

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
      link.textContent = "View item";
      meta.append(link);
    }

    if (meta.children.length) {
      card.append(meta);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const reserveButton = document.createElement("button");
    reserveButton.className = `card-button reserve${item.reserved ? " active" : ""}`;
    reserveButton.type = "button";
    reserveButton.textContent = item.reserved ? "Unreserve" : "Reserve";
    reserveButton.addEventListener("click", () => toggleReserved(item.id));

    const deleteButton = document.createElement("button");
    deleteButton.className = "card-button delete";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteItem(item.id));

    actions.append(reserveButton, deleteButton);
    card.append(actions);
    wishlist.append(card);
  });
}

function addItem(event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  if (!title) {
    titleInput.focus();
    return;
  }

  items = [
    createItem({
      title,
      description: descriptionInput.value.trim(),
      link: normalizeLink(linkInput.value.trim()),
      price: priceInput.value.trim(),
    }),
    ...items,
  ];

  saveItems();
  renderItems();
  form.reset();
  titleInput.focus();
}

function toggleReserved(id) {
  items = items.map((item) =>
    item.id === id ? { ...item, reserved: !item.reserved } : item,
  );
  saveItems();
  renderItems();
}

function deleteItem(id) {
  items = items.filter((item) => item.id !== id);
  saveItems();
  renderItems();
}

form.addEventListener("submit", addItem);

renderItems();
