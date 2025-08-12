// app.js (módulo)
// Import Firebase modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
  getDoc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/* ========================
   Configuración Firebase
   ======================== */
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
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

/* ========================
   Elementos del DOM (guardados)
   ========================= */
const $ = (id) => document.getElementById(id);
const loadingEl = document.getElementById('loading');
const authScreen = $('auth-screen');
const appScreen = $('app');
const displayNameEl = $('display-name');
const roleBadge = $('role-badge');
const leftRole = $('left-role');

const loginForm = $('login-form');
const signupForm = $('signup-form');
const showSignupBtn = $('show-signup');
const showLoginBtn = $('show-login');
const btnGoogle = $('btn-google');
const btnLogout = $('logout');

const btnNew = $('btn-new');
const modal = $('modal');
const closeModal = $('close-modal');
const requestForm = $('request-form');
const miniMapEl = $('mini-map');
const mapEl = $('map');
const listActive = $('list-active');
const historyEl = $('history');
const photoInput = $('photo');
const photoPreviewWrap = $('photo-preview');
const photoPreviewImg = photoPreviewWrap.querySelector('img');
const scheduleFields = $('schedule-fields');
const cancelRequestBtn = $('cancel-request');
const btnNewVisible = btnNew;

/* ========================
   Estado local
   ========================= */
let mainMap = null;
let miniMap = null;
let userMarker = null;
let selectedLocation = null;
let currentUser = null;
let currentRole = null;
let locationsWatchId = null;
let routingControl = null;
let markers = {}; // markers for requests / recyclers
let unsubscribes = [];

/* ========================
   Helpers UI
   ========================= */
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'note';
  t.textContent = msg;
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  loadingEl.classList.add('hidden');
}
function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  loadingEl.classList.add('hidden');
}

/* ========================
   Mapas (Leaflet)
   ========================= */
function initMainMap() {
  if (!mainMap && mapEl) {
    mainMap = L.map(mapEl).setView([4.7110, -74.0721], 12); // Bogotá default, ajusta si quieres
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mainMap);
  }
}

// mini map inside modal to pick location
function initMiniMap() {
  if (!miniMap && miniMapEl) {
    miniMap = L.map(miniMapEl, { zoomControl: false }).setView([4.7110, -74.0721], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);

    // Try to center on user geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        miniMap.setView([pos.coords.latitude, pos.coords.longitude], 15);
        setMiniMarker(pos.coords.latitude, pos.coords.longitude);
      });
    }

    miniMap.on('click', (e) => {
      selectedLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
      setMiniMarker(selectedLocation.lat, selectedLocation.lng);
    });
  }
}

let miniMarker = null;
function setMiniMarker(lat, lng) {
  if (miniMarker) miniMarker.setLatLng([lat, lng]);
  else {
    miniMarker = L.marker([lat, lng], { draggable: true }).addTo(miniMap);
    miniMarker.on('dragend', (e) => {
      const p = e.target.getLatLng();
      selectedLocation = { lat: p.lat, lng: p.lng };
    });
  }
}

/* show or update a marker on main map for a request */
function addOrUpdateRequestMarker(id, data) {
  if (!mainMap) initMainMap();
  if (markers[id]) {
    markers[id].setLatLng([data.ubicacion.lat, data.ubicacion.lng]);
  } else {
    const m = L.marker([data.ubicacion.lat, data.ubicacion.lng]).addTo(mainMap);
    m.bindPopup(`<div><strong>${data.tipoResiduo}</strong><div>${data.cantidad?.peso || ''}kg ${data.cantidad?.bolsas ? data.cantidad.bolsas+' bolsas' : ''}</div>
      <div class="mt-2"><button data-id="${id}" class="btn-accept">Aceptar</button></div></div>`);
    m.on('popupopen', () => {
      // attach click handler for accept button
      setTimeout(() => {
        const btn = document.querySelector('.btn-accept');
        if (btn) {
          btn.onclick = async (ev) => {
            const sid = ev.target.dataset.id;
            await acceptRequest(sid);
          };
        }
      }, 50);
    });
    markers[id] = m;
  }
}

function removeRequestMarker(id) {
  if (markers[id]) {
    mainMap.removeLayer(markers[id]);
    delete markers[id];
  }
}

/* ========================
   Firestore: Requests & Realtime listeners
   ========================= */
async function createRequest(payload) {
  // payload fields: tipoResiduo, cantidad, ubicacion {lat,lng}, tipoRecoleccion, fechaProgramada?, fotoURL?
  return await addDoc(collection(db, 'solicitudes'), {
    ...payload,
    estado: 'pendiente',
    userId: currentUser.uid,
    fechaCreacion: serverTimestamp()
  });
}

async function acceptRequest(requestId) {
  try {
    const reqRef = doc(db, 'solicitudes', requestId);
    await updateDoc(reqRef, { estado: 'aceptada', recicladorId: currentUser.uid });
    toast('Solicitud aceptada');
  } catch (e) {
    console.error(e);
    toast('Error al aceptar');
  }
}

/* Subscribe to pending requests (for recyclador) */
function subscribePendingRequests() {
  const q = query(collection(db, 'solicitudes'), where('estado', '==', 'pendiente'), orderBy('fechaCreacion', 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    listActive.innerHTML = '';
    snap.forEach(docSnap => {
      const id = docSnap.id;
      const data = docSnap.data();
      // add item to sidebar
      const item = document.createElement('div');
      item.className = 'p-3 rounded border';
      item.innerHTML = `<div class="flex justify-between items-start"><div><strong>${data.tipoResiduo}</strong><div class="text-xs text-slate-500">${data.cantidad?.peso || ''} kg</div></div>
        <div><button data-id="${id}" class="btn-accept-sidebar text-xs bg-emerald-600 text-white px-2 py-1 rounded">Aceptar</button></div></div>`;
      listActive.appendChild(item);

      // add to map
      if (data.ubicacion) addOrUpdateRequestMarker(id, data);
    });

    // attach accept handlers in sidebar
    document.querySelectorAll('.btn-accept-sidebar').forEach(btn => {
      btn.onclick = async (ev) => {
        const sid = ev.target.dataset.id;
        await acceptRequest(sid);
      };
    });
  });

  unsubscribes.push(unsub);
}

/* Subscribe to user's own requests (history & active) */
function subscribeUserRequests() {
  const q = query(collection(db, 'solicitudes'), where('userId', '==', currentUser.uid), orderBy('fechaCreacion', 'desc'));
  const unsub = onSnapshot(q, (snap) => {
    historyEl.innerHTML = '';
    snap.forEach(s => {
      const d = s.data();
      const el = document.createElement('div');
      el.className = 'p-2 rounded bg-white border';
      el.innerHTML = `<strong>${d.tipoResiduo}</strong> • <span class="text-xs text-slate-500">${d.estado}</span>`;
      historyEl.appendChild(el);
    });
  });

  unsubscribes.push(unsub);
}

/* Subscribe to a single solicitud to follow changes (e.g., reciclador assigned) */
function subscribeToSolicitud(solicitudId) {
  const unsub = onSnapshot(doc(db, 'solicitudes', solicitudId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    // If reciclador assigned, subscribe to its location doc
    if (data.recicladorId) {
      subscribeToLocation(data.recicladorId);
    }
  });
  unsubscribes.push(unsub);
}

/* ========================
   Locations (real-time positions)
   ========================= */
async function updateMyLocationFirestore(lat, lng, speed = null) {
  try {
    await setDoc(doc(db, 'locations', currentUser.uid), {
      lat, lng, speed: speed || null, updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) { console.error(e); }
}

/* subscribe to a recyclador location & show on map */
let locationMarkers = {};
function subscribeToLocation(recicladorUid) {
  const unsub = onSnapshot(doc(db, 'locations', recicladorUid), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    // show on main map
    if (!mainMap) initMainMap();
    if (locationMarkers[recicladorUid]) {
      locationMarkers[recicladorUid].setLatLng([d.lat, d.lng]);
    } else {
      locationMarkers[recicladorUid] = L.marker([d.lat, d.lng], { icon: L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25,41] }) }).addTo(mainMap);
      locationMarkers[recicladorUid].bindPopup('Reciclador en ruta');
    }
    // optionally compute route & ETA to a selected request (left as base)
    // if you have a specific request location, you can call addRoute(...)
  });
  unsubscribes.push(unsub);
}

/* Start watching geolocation (for reciclador) */
function startWatchPosition() {
  if (!navigator.geolocation) {
    toast('Geolocalización no disponible');
    return;
  }
  if (locationsWatchId) return;
  locationsWatchId = navigator.geolocation.watchPosition((pos) => {
    const lat = pos.coords.latitude, lng = pos.coords.longitude;
    updateMyLocationFirestore(lat, lng, pos.coords.speed || null);
  }, (err) => {
    console.warn('watchPosition err', err);
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 });
}

/* Stop watching */
function stopWatchPosition() {
  if (locationsWatchId) {
    navigator.geolocation.clearWatch(locationsWatchId);
    locationsWatchId = null;
  }
}

/* ========================
   UI interactions & form handling
   ========================= */
function resetModalForm() {
  requestForm.reset();
  selectedLocation = null;
  if (miniMarker) { miniMap.removeLayer(miniMarker); miniMarker = null; }
  photoPreviewWrap.classList.add('hidden');
}

showSignupBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  signupForm.classList.remove('hidden');
});

showLoginBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

/* Google sign-in: use redirect to avoid popup COOP warnings */
btnGoogle?.addEventListener('click', async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
    // After redirect, getRedirectResult will run in onLoad
  } catch (e) {
    console.error(e);
    toast(e.message || 'Error Google SignIn');
  }
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email-login').value.trim();
  const pw = $('password-login').value.trim();
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    toast('Sesión iniciada');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Error inicio sesión');
  }
});

signupForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('name-register').value.trim();
  const email = $('email-register').value.trim();
  const pw = $('password-register').value.trim();
  const role = $('role-register').value;
  if (!role) { toast('Selecciona un rol'); return; }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    // store profile in Firestore
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre: name || '',
      email,
      rol: role,
      creado: serverTimestamp()
    });
    toast('Usuario creado');
  } catch (err) {
    console.error(err);
    toast(err.message || 'Error registro');
  }
});

btnLogout?.addEventListener('click', async () => {
  await signOut(auth);
  toast('Sesión cerrada');
});

/* Modal open/close */
btnNew?.addEventListener('click', () => {
  modal.classList.remove('hidden');
  initMiniMap();
});
closeModal?.addEventListener('click', () => { modal.classList.add('hidden'); resetModalForm(); });
cancelRequestBtn?.addEventListener('click', () => { modal.classList.add('hidden'); resetModalForm(); });

/* Photo preview */
photoInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) { photoPreviewWrap.classList.add('hidden'); return; }
  const url = URL.createObjectURL(file);
  photoPreviewImg.src = url;
  photoPreviewWrap.classList.remove('hidden');
});

/* schedule toggle */
requestForm.querySelectorAll('input[name="collect"]').forEach(r => {
  r.addEventListener('change', (ev) => {
    if (ev.target.value === 'programada') scheduleFields.classList.remove('hidden');
    else scheduleFields.classList.add('hidden');
  });
});

/* Submit new request */
requestForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const tipoResiduo = $('res-type').value;
  if (!tipoResiduo) { toast('Selecciona tipo de residuo'); return; }
  const cantidad = { peso: $('weight').value || null, bolsas: $('bags').value || null };
  const tipoRecoleccion = requestForm.querySelector('input[name="collect"]:checked').value;
  let fechaProgramada = null;
  if (tipoRecoleccion === 'programada') {
    const d = $('date-s').value, t = $('time-s').value;
    if (!d || !t) { toast('Selecciona fecha y hora'); return; }
    fechaProgramada = new Date(`${d}T${t}`);
  }
  if (!selectedLocation) { toast('Selecciona ubicación en el mini-mapa'); return; }

  // optional photo upload
  let fotoURL = null;
  const file = photoInput.files[0];
  if (file) {
    try {
      const path = `solicitudes/${currentUser.uid}/${Date.now()}_${file.name}`;
      const ref = storageRef(storage, path);
      const snap = await uploadBytes(ref, file);
      fotoURL = await getDownloadURL(snap.ref);
    } catch (e) { console.error('upload', e); toast('Error al subir foto'); }
  }

  try {
    await createRequest({
      tipoResiduo,
      cantidad,
      ubicacion: selectedLocation,
      tipoRecoleccion,
      fechaProgramada: fechaProgramada ? fechaProgramada : null,
      fotoURL
    });
    toast('Solicitud creada');
    modal.classList.add('hidden');
    resetModalForm();
  } catch (e) {
    console.error(e);
    toast('Error al crear solicitud');
  }
});

/* ========================
   Auth state & initialization
   ========================= */
async function appInitForUser(user) {
  // get profile role from Firestore
  const udoc = await getDoc(doc(db, 'usuarios', user.uid));
  if (udoc.exists()) {
    currentRole = udoc.data().rol || 'usuario';
    displayNameEl.textContent = udoc.data().nombre || user.email;
  } else {
    // default: create user doc as 'usuario'
    await setDoc(doc(db, 'usuarios', user.uid), {
      nombre: user.displayName || user.email,
      email: user.email,
      rol: 'usuario',
      creado: serverTimestamp()
    }, { merge: true });
    currentRole = 'usuario';
    displayNameEl.textContent = user.displayName || user.email;
  }
  roleBadge.textContent = currentRole;
  leftRole.textContent = currentRole;

  // Initialize maps & subscriptions
  initMainMap();
  subscribeUserRequests();

  if (currentRole === 'reciclador') {
    // recyclers watch pending requests and share location
    subscribePendingRequests();
    startWatchPosition();
  } else {
    // user: show pending requests nearby? for now show user's own history and allow creating requests
    subscribePendingRequests(); // users can still see pending list (optional) - comment this out if not desired
    subscribeUserRequests();
  }
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    showApp();
    // handle redirect result (Google) - optional; getRedirectResult is called once after redirect
    try {
      const result = await getRedirectResult(auth);
      if (result && result.user) {
        // result.user is signed in
      }
    } catch (e) {
      console.warn('getRedirectResult', e);
    }
    await appInitForUser(user);
    console.log('Usuario activo:', user.email);
    toast(`Bienvenido ${user.email}`);
  } else {
    currentUser = null;
    currentRole = null;
    showAuth();
    // cleanup subscriptions
    unsubscribes.forEach(u => typeof u === 'function' && u());
    unsubscribes = [];
    stopWatchPosition();
    // remove markers
    Object.keys(markers).forEach(k => removeRequestMarker(k));
    Object.keys(locationMarkers).forEach(k => { if (locationMarkers[k]) mainMap.removeLayer(locationMarkers[k]); });
  }
});

/* handle redirect result if user landed after Google redirect (some browsers may need this) */
(async () => {
  try {
    await getRedirectResult(auth);
  } catch (e) { /* ignore if no redirect result */ }
})();

/* Hide loading once DOM ready */
window.addEventListener('load', () => {
  if (loadingEl) loadingEl.classList.add('hidden');
});

/* ========================
   Notes & future hooks
   ========================= */
/*
 - Este es un punto de partida completo.
 - Reglas de seguridad Firestore recomendadas:
   - usuarios/{uid} solo editable por uid
   - solicitudes: lectura pública; escritura por usuarios autenticados con userId == auth.uid
   - locations/{uid} writable solo por auth.uid == uid
 - Para mejorar: cálculo ETA automático en UI con LRM cuando reciclador y solicitud estén asignados.
*/
