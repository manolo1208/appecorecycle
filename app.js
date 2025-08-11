// ==== Firebase SDK ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==== Configuración Firebase ====
const firebaseConfig = {
  apiKey: "AIzaSyDldwAinbDTnq9MCJSbRn_VwiFI_0doQNg",
  authDomain: "reciclapp-40cc3.firebaseapp.com",
  projectId: "reciclapp-40cc3",
  storageBucket: "reciclapp-40cc3.firebasestorage.app",
  messagingSenderId: "660641469771",
  appId: "1:660641469771:web:1a74ccc8537c8c0bd5c4ce",
  measurementId: "G-D5DHYTQTFK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const providerGoogle = new GoogleAuthProvider();

// ==== Elementos UI ====
const authScreen = document.getElementById("auth-screen");
const appContainer = document.getElementById("app-container");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginGoogleBtn = document.getElementById("login-google");
const logoutBtn = document.getElementById("logout-btn");
const btnNuevaSolicitud = document.getElementById("btn-nueva-solicitud");
const modalForm = document.getElementById("modal-form");
const closeModal = document.getElementById("close-modal");
const cancelForm = document.getElementById("btn-cancel-form");
const formSolicitud = document.getElementById("formSolicitud");
const solicitudesActivas = document.getElementById("solicitudes-activas");
const toastContainer = document.getElementById("toast");
const previewImgContainer = document.getElementById("preview-img");
const previewImg = previewImgContainer.querySelector("img");
let miniMap, mainMap, routingControl;
let currentUser, currentRole, watchId;

// ==== Funciones UI ====
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast-item";
  t.textContent = msg;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function showSectionAuth() {
  authScreen.classList.remove("hidden");
  appContainer.classList.add("hidden");
}

function showSectionApp() {
  authScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
}

// ==== Auth: Google ====
loginGoogleBtn.addEventListener("click", async () => {
  try {
    const result = await signInWithPopup(auth, providerGoogle);
    await saveUserData(result.user, "usuario"); // por defecto usuario
    showToast("Bienvenido " + result.user.displayName);
  } catch (err) {
    console.error(err);
    showToast("Error en login con Google");
  }
});

// ==== Auth: Email/Password ====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email-login").value;
  const pass = document.getElementById("password-login").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Sesión iniciada");
  } catch (err) {
    console.error(err);
    showToast("Error al iniciar sesión");
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("nombre-register").value;
  const email = document.getElementById("email-register").value;
  const pass = document.getElementById("password-register").value;
  const rol = document.getElementById("rol-register").value;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await saveUserData(cred.user, rol);
    showToast("Cuenta creada");
  } catch (err) {
    console.error(err);
    showToast("Error al registrar");
  }
});

async function saveUserData(user, rol) {
  await setDoc(doc(db, "users", user.uid), {
    nombre: user.displayName || "",
    email: user.email,
    rol,
    creado: serverTimestamp()
  }, { merge: true });
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  showToast("Sesión cerrada");
});

// ==== Estado Auth ====
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    const snap = await getDoc(doc(db, "users", user.uid));
    currentRole = snap.exists() ? snap.data().rol : "usuario";
    initApp();
    showSectionApp();
  } else {
    showSectionAuth();
  }
});

// ==== Inicializar app ====
function initApp() {
  initMap();
  listenSolicitudes();
}

// ==== Mapa ====
function initMap() {
  mainMap = L.map("map-canvas").setView([7.065, -73.854], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mainMap);
}

function addOrUpdateRoute(from, to) {
  if (routingControl) mainMap.removeControl(routingControl);
  routingControl = L.Routing.control({
    waypoints: [L.latLng(from.lat, from.lng), L.latLng(to.lat, to.lng)],
    routeWhileDragging: false,
    show: false,
    addWaypoints: false
  }).addTo(mainMap);
}

// ==== Solicitudes ====
btnNuevaSolicitud.addEventListener("click", () => modalForm.classList.remove("hidden"));
closeModal.addEventListener("click", () => modalForm.classList.add("hidden"));
cancelForm.addEventListener("click", () => modalForm.classList.add("hidden"));

formSolicitud.addEventListener("submit", async (e) => {
  e.preventDefault();
  const tipo = document.getElementById("tipoResiduo").value;
  const peso = document.getElementById("cantidad-peso").value;
  const bolsas = document.getElementById("cantidad-bolsas").value;
  const file = document.getElementById("fotoResiduo").files[0];
  let fotoURL = null;
  if (file) {
    const storageRef = ref(storage, "residuos/" + Date.now() + "-" + file.name);
    await uploadBytes(storageRef, file);
    fotoURL = await getDownloadURL(storageRef);
  }
  await addDoc(collection(db, "solicitudes"), {
    uid: currentUser.uid,
    tipo,
    peso,
    bolsas,
    foto: fotoURL,
    estado: "pendiente",
    creado: serverTimestamp()
  });
  showToast("Solicitud enviada");
  modalForm.classList.add("hidden");
});

function listenSolicitudes() {
  const q = query(collection(db, "solicitudes"), where("estado", "==", "pendiente"));
  onSnapshot(q, (snap) => {
    solicitudesActivas.innerHTML = "";
    snap.forEach(docu => {
      const d = docu.data();
      const div = document.createElement("div");
      div.className = "p-3 rounded bg-emerald-50";
      div.textContent = `${d.tipo} - ${d.peso || "?"}kg`;
      solicitudesActivas.appendChild(div);
    });
  });
}
