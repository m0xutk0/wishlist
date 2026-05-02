import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Вставьте сюда реальный firebaseConfig из настроек вашего проекта Firebase.
// Также включите Firestore Database и Anonymous Auth в Firebase Console.
const firebaseConfig = {
  apiKey: "AIzaSyACpOo7soWcSDWRUlYvdMo6v7hJhApYnGg",
  authDomain: "wishlist-745af.firebaseapp.com",
  projectId: "wishlist-745af",
  storageBucket: "wishlist-745af.firebasestorage.app",
  messagingSenderId: "14410995349",
  appId: "1:14410995349:web:fa4f49006d11262425ad9c"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Анонимный вход нужен, чтобы гости могли работать с Firestore без аккаунта.
signInAnonymously(auth).catch((error) => {
  console.error("Ошибка анонимной авторизации:", error);
});
