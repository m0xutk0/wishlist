import { auth, db, signInWithGoogle } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
Firestore rules should be:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wishlist/{docId} {
      allow read: if true;
      allow create, delete: if request.auth.token.email == "YOUR_GOOGLE_EMAIL@gmail.com";
      allow update: if request.auth != null;
    }
  }
}
*/

const OWNER_EMAIL = "zarnakovmaksim5@gmail.com";
const wishlistCollection = collection(db, "wishlist");

const titleInput = document.querySelector("#title");
const linkInput = document.querySelector("#link");
const priceInput = document.querySelector("#price");
const addBtn = document.querySelector("#addBtn");
const loginBtn = document.querySelector("#loginBtn");
const userInfo = document.querySelector("#userInfo");
const wishlist = document.querySelector("#wishlist");

let currentUser = null;

const statusLabels = {
  available: "Свободно",
  reserved: "Забронировано",
  purchased: "Куплено",
};

addBtn.addEventListener("click", addItem);

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error("Login error:", e);
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    console.log("User:", user.email);
    userInfo.innerText = "Вы вошли как: " + user.email;
  } else {
    userInfo.innerText = "";
  }

  toggleOwnerControls();
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
  if (!currentUser || currentUser.email !== OWNER_EMAIL) {
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

    if (currentUser?.email === OWNER_EMAIL) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "action delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", () => deleteItem(item.id));
      actions.append(deleteBtn);
    }

    card.append(actions);
    wishlist.append(card);
  });
}

async function updateStatus(id, status) {
  const itemRef = doc(db, "wishlist", id);
  await updateDoc(itemRef, { status });
}

async function deleteItem(id) {
  if (!currentUser || currentUser.email !== OWNER_EMAIL) {
    alert("Только владелец может удалять подарки");
    return;
  }

  const itemRef = doc(db, "wishlist", id);
  await deleteDoc(itemRef);
}

function toggleOwnerControls() {
  addBtn.style.display = currentUser?.email === OWNER_EMAIL ? "" : "none";
}

function normalizeLink(link) {
  if (!link) {
    return "";
  }

  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}
