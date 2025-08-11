// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ======= Configuración Firebase =======
const firebaseConfig = {
  apiKey: "AIzaSyDldwAinbDTnq9MCJSbRn_VwiFI_0doQNg",
  authDomain: "reciclapp-40cc3.firebaseapp.com",
  projectId: "reciclapp-40cc3",
  storageBucket: "reciclapp-40cc3.appspot.com",
  messagingSenderId: "660641469771",
  appId: "1:660641469771:web:102ee2a2885147e7d5c4ce",
  measurementId: "G-DERT7TM0N4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ======= Elementos DOM =======
const authScreen = document.getElementById("auth-screen");
const appContainer = document.getElementById("app-container");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const showRegisterBtn = document.getElementById("show-register");
const showLoginBtn = document.getElementById("show-login");
const logoutBtn = document.getElementById("logout-btn");
const loginGoogleBtn = document.getElementById("login-google");

// ======= Funciones =======
function showAuth() {
  authScreen.classList.remove("hidden");
  appContainer.classList.add("hidden");
}
function showApp() {
  authScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
}

// ======= Eventos =======
showRegisterBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.classList.add("hidden");
  signupForm.classList.remove("hidden");
});

showLoginBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  signupForm.classList.add("hidden");
  loginForm.classList.remove("hidden");
});

loginForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("email-login").value;
  const password = document.getElementById("password-login").value;
  signInWithEmailAndPassword(auth, email, password)
    .catch(err => alert(err.message));
});

signupForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombre-register").value;
  const email = document.getElementById("email-register").value;
  const password = document.getElementById("password-register").value;
  createUserWithEmailAndPassword(auth, email, password)
    .catch(err => alert(err.message));
});

loginGoogleBtn?.addEventListener("click", () => {
  signInWithPopup(auth, provider)
    .catch(err => alert(err.message));
});

logoutBtn?.addEventListener("click", () => {
  signOut(auth);
});

// ======= Estado Auth =======
onAuthStateChanged(auth, (user) => {
  if (user) {
    showApp();
    console.log("Usuario activo:", user.email);
  } else {
    showAuth();
  }
});
