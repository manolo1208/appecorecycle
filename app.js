// ======= Inicialización segura =======
document.addEventListener("DOMContentLoaded", () => {

  // ======= Firebase =======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

const firebaseConfig = {
  apiKey: "AIzaSyDldwAinbDTnq9MCJSbRn_VwiFI_0doQNg",
  authDomain: "reciclapp-40cc3.firebaseapp.com",
  projectId: "reciclapp-40cc3",
  storageBucket: "reciclapp-40cc3.appspot.com", // corregido
  messagingSenderId: "660641469771",
  appId: "1:660641469771:web:102ee2a2885147e7d5c4ce",
  measurementId: "G-DERT7TM0N4"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);


  // ======= DOM Elements =======
  const authScreen = document.getElementById("auth-screen");
  const appContainer = document.getElementById("app-container");
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");
  const showRegisterBtn = document.getElementById("show-register");
  const showLoginBtn = document.getElementById("show-login");
  const logoutBtn = document.getElementById("logout-btn");
  const loginGoogleBtn = document.getElementById("login-google");

  // ======= Funciones de UI =======
  function showAuth() {
    authScreen.classList.remove("hidden");
    appContainer.classList.add("hidden");
  }

  function showApp() {
    authScreen.classList.add("hidden");
    appContainer.classList.remove("hidden");
  }

  // ======= Eventos =======
  if (showRegisterBtn) {
    showRegisterBtn.addEventListener("click", (e) => {
      e.preventDefault();
      loginForm.classList.add("hidden");
      signupForm.classList.remove("hidden");
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      signupForm.classList.add("hidden");
      loginForm.classList.remove("hidden");
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email-login").value;
      const password = document.getElementById("password-login").value;
      signInWithEmailAndPassword(auth, email, password)
        .then(() => {
          console.log("Login exitoso");
        })
        .catch(err => alert(err.message));
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nombre = document.getElementById("nombre-register").value;
      const email = document.getElementById("email-register").value;
      const password = document.getElementById("password-register").value;
      createUserWithEmailAndPassword(auth, email, password)
        .then(() => {
          console.log("Usuario registrado:", nombre);
        })
        .catch(err => alert(err.message));
    });
  }

  if (loginGoogleBtn) {
    loginGoogleBtn.addEventListener("click", () => {
      const provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider)
        .then(() => console.log("Login con Google exitoso"))
        .catch(err => alert(err.message));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).then(() => {
        console.log("Sesión cerrada");
      });
    });
  }

  // ======= Cambios de estado =======
  onAuthStateChanged(auth, (user) => {
    if (user) {
      showApp();
      console.log("Usuario activo:", user.email);
    } else {
      showAuth();
    }
  });

  // ======= Verificación de dominio =======
  const allowedDomains = [
    "localhost",
    "127.0.0.1",
    "appreciclaje-b7b2a.firebaseapp.com",
    "appreciclaje-b7b2a.web.app",
    "usuario.github.io"
  ];
  if (!allowedDomains.includes(location.hostname)) {
    alert(`El dominio ${location.hostname} no está autorizado en Firebase`);
  }
});
