import { auth, db, signInWithGoogle } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/*
Firestore rules should be:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /wishlist/{docId} {
      allow read: if true;

      // only Google-authenticated users can update; banned users are blocked
      allow update: if request.auth != null
        && request.auth.token.email != null
        && !exists(/databases/$(database)/documents/bannedUsers/$(request.auth.token.email));

      // only owner can create/delete
      allow create, delete:
        if request.auth.token.email == "OWNER_EMAIL@gmail.com";
    }

    match /bannedUsers/{docId} {
      allow read: if false;
      allow write:
        if request.auth.token.email == "OWNER_EMAIL@gmail.com";
    }

    match /siteState/{docId} {
      allow read: if true;
      allow write:
        if request.auth.token.email == "OWNER_EMAIL@gmail.com";
    }
  }
}
*/

const OWNER_EMAIL = "zarnakovmaksim5@gmail.com";
const ADMIN_NOTICE_TTL = 24 * 60 * 60 * 1000;

const wishlistCollection = collection(db, "wishlist");
const bannedUsersCollection = collection(db, "bannedUsers");
const adminPanelStateRef = doc(db, "siteState", "adminPanel");

const titleInput = document.querySelector("#title");
const linkInput = document.querySelector("#link");
const priceInput = document.querySelector("#price");
const addBtn = document.querySelector("#addBtn");
const loginBtn = document.querySelector("#loginBtn");
const adminPanelBtn = document.querySelector("#adminPanelBtn");
const deleteAllBtn = document.querySelector("#deleteAllBtn");
const jsonInput = document.querySelector("#jsonInput");
const ownerPanel = document.querySelector("#ownerPanel");
const adminPanel = document.querySelector("#adminPanel");
const adminList = document.querySelector("#adminList");
const authNotice = document.querySelector("#authNotice");
const adminOpenNotice = document.querySelector("#adminOpenNotice");
const userInfo = document.querySelector("#userInfo");
const wishlist = document.querySelector("#wishlist");

let currentUser = null;
let currentItems = [];

const statusLabels = {
  available: "Свободно",
  reserved: "Забронировано",
  purchased: "Куплено",
};

addBtn.addEventListener("click", addItem);
adminPanelBtn.addEventListener("click", openAdminPanel);
deleteAllBtn.addEventListener("click", deleteAllItems);
jsonInput.addEventListener("change", importJson);

loginBtn.addEventListener("click", async () => {
  try {
    await signInWithGoogle();
  } catch (e) {
    console.error("Login error:", e);
  }
});

onAuthStateChanged(auth, (user) => {
  // Старые anonymous-сессии Firebase не имеют email, поэтому считаем их гостями.
  currentUser = user?.email ? user : null;

  if (currentUser) {
    console.log("User:", currentUser.email);
    userInfo.innerText = "Вы вошли как: " + currentUser.email;
  } else {
    userInfo.innerText = "";
    adminPanel.classList.add("hidden");
  }

  updateAuthUi();
  renderItems(currentItems);
  renderAdminPanel();
});

// Firestore обновляет список в реальном времени у всех пользователей.
onSnapshot(wishlistCollection, (snapshot) => {
  currentItems = snapshot.docs.map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  }));

  renderItems(currentItems);
  renderAdminPanel();
});

// Все пользователи видят время последнего открытия панели владельца в течение 1 дня.
onSnapshot(adminPanelStateRef, (snapshot) => {
  renderAdminOpenNotice(snapshot.data());
});

async function addItem() {
  if (!isOwner()) {
    alert("Только владелец может добавлять подарки");
    return;
  }

  if (await checkIfBanned(currentUser.email)) {
    alert("Вы заблокированы владельцем");
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
    reservedBy: null,
    purchasedBy: null,
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
    empty.textContent = "Список пока пуст.";
    wishlist.append(empty);
    return;
  }

  items.forEach((item) => {
    const normalizedItem = normalizeItem(item);
    const card = document.createElement("article");
    card.className = "card";

    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = normalizedItem.title;

    const badge = document.createElement("span");
    badge.className = `badge ${normalizedItem.status}`;
    badge.textContent = statusLabels[normalizedItem.status] || normalizedItem.status;

    header.append(title, badge);
    card.append(header);

    if (normalizedItem.price) {
      const price = document.createElement("p");
      price.className = "price";
      price.textContent = normalizedItem.price;
      card.append(price);
    }

    if (normalizedItem.link) {
      const link = document.createElement("a");
      link.className = "item-link";
      link.href = normalizedItem.link;
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
    reserveBtn.disabled =
      !isGoogleUser() ||
      normalizedItem.status === "reserved" ||
      normalizedItem.status === "purchased";
    reserveBtn.addEventListener("click", () => updateStatus(normalizedItem.id, "reserved"));

    const purchasedBtn = document.createElement("button");
    purchasedBtn.className = "action purchase";
    purchasedBtn.type = "button";
    purchasedBtn.textContent = "Куплено";
    purchasedBtn.disabled = !isGoogleUser() || normalizedItem.status === "purchased";
    purchasedBtn.addEventListener("click", () => updateStatus(normalizedItem.id, "purchased"));

    actions.append(reserveBtn, purchasedBtn);

    if (isOwner()) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "action delete";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", () => deleteItem(normalizedItem.id));
      actions.append(deleteBtn);
    }

    card.append(actions);
    wishlist.append(card);
  });
}

async function updateStatus(id, status) {
  if (!requireAuth()) {
    return;
  }

  if (await checkIfBanned(currentUser.email)) {
    alert("Вы заблокированы владельцем");
    return;
  }

  const itemRef = doc(db, "wishlist", id);
  const update = { status };

  if (status === "reserved") {
    update.reservedBy = currentUser.email;
    update.purchasedBy = null;
  }

  if (status === "purchased") {
    update.purchasedBy = currentUser.email;
  }

  try {
    await updateDoc(itemRef, update);
  } catch (error) {
    handleActionError(error);
  }
}

async function deleteItem(id) {
  if (!isOwner()) {
    alert("Только владелец может удалять подарки");
    return;
  }

  if (await checkIfBanned(currentUser.email)) {
    alert("Вы заблокированы владельцем");
    return;
  }

  const itemRef = doc(db, "wishlist", id);
  await deleteDoc(itemRef);
}

async function deleteAllItems() {
  if (!isOwner()) {
    alert("Только владелец может удалять подарки");
    return;
  }

  if (await checkIfBanned(currentUser.email)) {
    alert("Вы заблокированы владельцем");
    return;
  }

  if (!confirm("Удалить весь список желаний?")) {
    return;
  }

  const snapshot = await getDocs(wishlistCollection);
  const batch = writeBatch(db);

  snapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  await batch.commit();
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  if (!isOwner()) {
    alert("Только владелец может загружать JSON");
    jsonInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.addEventListener("load", async () => {
    try {
      if (await checkIfBanned(currentUser.email)) {
        alert("Вы заблокированы владельцем");
        return;
      }

      const importedItems = JSON.parse(reader.result);
      if (!Array.isArray(importedItems)) {
        throw new Error("JSON должен быть массивом подарков");
      }

      await replaceWishlist(normalizeImportedItems(importedItems));
    } catch (error) {
      alert("Не удалось загрузить JSON: " + error.message);
    } finally {
      jsonInput.value = "";
    }
  });

  reader.readAsText(file);
}

async function replaceWishlist(items) {
  const snapshot = await getDocs(wishlistCollection);
  const batch = writeBatch(db);

  snapshot.forEach((itemDoc) => {
    batch.delete(itemDoc.ref);
  });

  items.forEach((item) => {
    const itemRef = doc(wishlistCollection);
    batch.set(itemRef, item);
  });

  await batch.commit();
}

async function checkIfBanned(email) {
  if (!email) {
    return false;
  }

  try {
    const bannedQuery = query(bannedUsersCollection, where("email", "==", email));
    const snapshot = await getDocs(bannedQuery);
    return !snapshot.empty;
  } catch (error) {
    console.warn("Не удалось проверить бан-лист на клиенте:", error);
    return false;
  }
}

function requireAuth() {
  if (!isGoogleUser()) {
    alert("Войдите через Google, чтобы взаимодействовать со списком");
    return false;
  }

  return true;
}

async function openAdminPanel() {
  if (!isOwner()) {
    return;
  }

  const willOpen = adminPanel.classList.contains("hidden");
  adminPanel.classList.toggle("hidden");
  renderAdminPanel();

  if (willOpen) {
    const openedAt = new Date();
    renderAdminOpenNotice({
      openedAtMs: openedAt.getTime(),
      openedBy: currentUser.email,
    });

    try {
      await setDoc(
        adminPanelStateRef,
        {
          openedAt: serverTimestamp(),
          openedAtMs: openedAt.getTime(),
          openedAtIso: openedAt.toISOString(),
          openedBy: currentUser.email,
        },
        { merge: true },
      );
    } catch (error) {
      console.warn("Не удалось сохранить время открытия панели:", error);
    }
  }
}

async function banUser(email) {
  if (!isOwner() || !email) {
    return;
  }

  await setDoc(doc(db, "bannedUsers", email), { email });
  alert("Пользователь заблокирован: " + email);
}

async function resetItem(id) {
  if (!isOwner()) {
    return;
  }

  const itemRef = doc(db, "wishlist", id);
  await updateDoc(itemRef, {
    status: "available",
    reservedBy: null,
    purchasedBy: null,
  });
}

function renderAdminPanel() {
  if (!isOwner() || adminPanel.classList.contains("hidden")) {
    adminList.innerHTML = "";
    return;
  }

  adminList.innerHTML = "";

  if (currentItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Действий пользователей пока нет.";
    adminList.append(empty);
    return;
  }

  currentItems.map(normalizeItem).forEach((item) => {
    const row = document.createElement("article");
    row.className = "admin-item";

    const title = document.createElement("h3");
    title.textContent = item.title;

    const reservedBy = document.createElement("p");
    reservedBy.textContent = "Бронь: " + (item.reservedBy || "нет");

    const purchasedBy = document.createElement("p");
    purchasedBy.textContent = "Покупка: " + (item.purchasedBy || "нет");

    const actions = document.createElement("div");
    actions.className = "actions";

    if (item.status === "reserved") {
      const resetBtn = document.createElement("button");
      resetBtn.className = "action";
      resetBtn.type = "button";
      resetBtn.textContent = "Снять бронь";
      resetBtn.addEventListener("click", () => resetItem(item.id));
      actions.append(resetBtn);
    }

    if (item.status === "purchased") {
      const resetPurchaseBtn = document.createElement("button");
      resetPurchaseBtn.className = "action";
      resetPurchaseBtn.type = "button";
      resetPurchaseBtn.textContent = "Отменить покупку";
      resetPurchaseBtn.addEventListener("click", () => resetItem(item.id));
      actions.append(resetPurchaseBtn);
    }

    if (item.reservedBy) {
      const banReservedBtn = document.createElement("button");
      banReservedBtn.className = "action delete";
      banReservedBtn.type = "button";
      banReservedBtn.textContent = "Забанить пользователя";
      banReservedBtn.addEventListener("click", () => banUser(item.reservedBy));
      actions.append(banReservedBtn);
    }

    if (item.purchasedBy) {
      const banPurchasedBtn = document.createElement("button");
      banPurchasedBtn.className = "action delete";
      banPurchasedBtn.type = "button";
      banPurchasedBtn.textContent = "Забанить покупателя";
      banPurchasedBtn.addEventListener("click", () => banUser(item.purchasedBy));
      actions.append(banPurchasedBtn);
    }

    row.append(title, reservedBy, purchasedBy, actions);
    adminList.append(row);
  });
}

function renderAdminOpenNotice(data) {
  const openedAt = getAdminOpenedAt(data);

  if (!openedAt) {
    hideAdminOpenNotice();
    return;
  }

  if (Date.now() > openedAt.getTime() + ADMIN_NOTICE_TTL) {
    hideAdminOpenNotice();
    return;
  }

  adminOpenNotice.textContent =
    "Панель владельца была открыта: " + formatDateTime(openedAt);
  adminOpenNotice.classList.remove("hidden");
}

function getAdminOpenedAt(data) {
  if (data?.openedAt?.toDate) {
    return data.openedAt.toDate();
  }

  if (typeof data?.openedAtMs === "number") {
    return new Date(data.openedAtMs);
  }

  if (data?.openedAtIso) {
    const parsedDate = new Date(data.openedAtIso);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function hideAdminOpenNotice() {
  adminOpenNotice.textContent = "";
  adminOpenNotice.classList.add("hidden");
}

function normalizeImportedItems(items) {
  return items
    .filter((item) => item && (item.title || item.name))
    .map((item) => {
      const status = ["available", "reserved", "purchased"].includes(item.status)
        ? item.status
        : "available";

      return {
        title: String(item.title || item.name).trim(),
        link: normalizeLink(item.link ? String(item.link).trim() : ""),
        price: item.price ? String(item.price).trim() : "",
        status,
        reservedBy: item.reservedBy || null,
        purchasedBy: item.purchasedBy || null,
      };
    });
}

function normalizeItem(item) {
  return {
    id: item.id,
    title: item.title || "",
    link: item.link || "",
    price: item.price || "",
    status: item.status || "available",
    reservedBy: item.reservedBy || null,
    purchasedBy: item.purchasedBy || null,
  };
}

function updateAuthUi() {
  loginBtn.style.display = isGoogleUser() ? "none" : "";
  authNotice.classList.toggle("hidden", isGoogleUser());
  ownerPanel.classList.toggle("hidden", !isOwner());
  adminPanelBtn.style.display = isOwner() ? "" : "none";

  if (!isOwner()) {
    adminPanel.classList.add("hidden");
  }
}

function isOwner() {
  return currentUser?.email === OWNER_EMAIL;
}

function isGoogleUser() {
  return Boolean(currentUser?.email);
}

function handleActionError(error) {
  console.error("Action error:", error);

  if (error.code === "permission-denied") {
    alert("Вы заблокированы владельцем");
    return;
  }

  alert("Не удалось выполнить действие. Попробуйте позже.");
}

function normalizeLink(link) {
  if (!link) {
    return "";
  }

  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
