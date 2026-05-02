import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const wishlistCollection = collection(db, "wishlist");

const titleInput = document.querySelector("#title");
const linkInput = document.querySelector("#link");
const priceInput = document.querySelector("#price");
const addBtn = document.querySelector("#addBtn");
const wishlist = document.querySelector("#wishlist");
const OWNER_UID = "bxtwjxzzSvbuagJQJeTjCEP0Kit1";

const statusLabels = {
  available: "Свободно",
  reserved: "Забронировано",
  purchased: "Куплено",
};

addBtn.addEventListener("click", addItem);

onAuthStateChanged(auth, (user) => {
  toggleOwnerControls(user);
});

// Firestore обновляет список в реальном времени у всех пользователей.
onSnapshot(wishlistCollection, (snapshot) => {
  const items = snapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  }));

  renderItems(items);
});

async function addItem() {
  if (auth.currentUser?.uid !== OWNER_UID) {
    alert("Только владелец может добавлять подарки");
    return;
  }

  const title = titleInput.value.trim();
  const link = normalizeLink(linkInput.value.trim());
  const price = priceInput.value.trim();

  if (!title) {
    titleInput.focus();
    return;
  }

  await addDoc(wishlistCollection, {
    title,
    link,
    price,
    status: "available",
  });

  titleInput.value = "";
  linkInput.value = "";
  priceInput.value = "";
  titleInput.focus();
}

function toggleOwnerControls(user) {
  if (user?.uid !== OWNER_UID) {
    document.getElementById("addBtn").style.display = "none";
    return;
  }

  document.getElementById("addBtn").style.display = "";
}

function renderItems(items) {
  wishlist.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Список пока пуст. Добавьте первый подарок.";
    wishlist.append(empty);
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = item.title;

    const badge = document.createElement("span");
    badge.className = `badge ${item.status}`;
    badge.textContent = statusLabels[item.status] || item.status;

    header.append(title, badge);
    card.append(header);

    if (item.price) {
      const price = document.createElement("p");
      price.className = "price";
      price.textContent = item.price;
      card.append(price);
    }

    if (item.link) {
      const link = document.createElement("a");
      link.className = "item-link";
      link.href = item.link;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Открыть ссылку";
      card.append(link);
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const reserveBtn = document.createElement("button");
    reserveBtn.className = "action reserve";
    reserveBtn.type = "button";
    reserveBtn.textContent = "Забронировать";
    reserveBtn.disabled = item.status === "reserved" || item.status === "purchased";
    reserveBtn.addEventListener("click", () => updateStatus(item.id, "reserved"));

    const purchasedBtn = document.createElement("button");
    purchasedBtn.className = "action purchase";
    purchasedBtn.type = "button";
    purchasedBtn.textContent = "Куплено";
    purchasedBtn.disabled = item.status === "purchased";
    purchasedBtn.addEventListener("click", () => updateStatus(item.id, "purchased"));

    actions.append(reserveBtn, purchasedBtn);
    card.append(actions);
    wishlist.append(card);
  });
}

async function updateStatus(id, status) {
  const itemRef = doc(db, "wishlist", id);
  await updateDoc(itemRef, { status });
}

function normalizeLink(link) {
  if (!link) {
    return "";
  }

  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}
