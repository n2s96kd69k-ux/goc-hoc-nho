// ===== Đồng bộ đám mây với Firebase (Auth + Firestore) =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDvFrAbTZM3JXNyQYp6_q4L-STw5tjm3M4",
  authDomain: "goc-hoc-48ad4.firebaseapp.com",
  projectId: "goc-hoc-48ad4",
  storageBucket: "goc-hoc-48ad4.firebasestorage.app",
  messagingSenderId: "1069473754445",
  appId: "1:1069473754445:web:f5ee5ad665e878d8661b04",
  measurementId: "G-BS9S90NCGH"
};

let app = null;
let auth = null;
let db = null;
let currentUser = null;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.warn('Không thể khởi tạo Firebase:', e);
}

export function getCurrentUser() {
  return currentUser;
}

export function onCloudAuthChange(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, (user) => {
    currentUser = user || null;
    callback(currentUser);
  });
}

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebase chưa sẵn sàng.');
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function loginWithEmail(email, password) {
  if (!auth) throw new Error('Firebase chưa sẵn sàng.');
  const res = await signInWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function registerWithEmail(email, password) {
  if (!auth) throw new Error('Firebase chưa sẵn sàng.');
  const res = await createUserWithEmailAndPassword(auth, email, password);
  return res.user;
}

export async function logoutCloud() {
  if (!auth) return;
  await signOut(auth);
}

export async function loadCloudState(uid) {
  if (!db || !uid) return null;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data && data.state ? data.state : null;
}

export async function saveCloudState(uid, state) {
  if (!db || !uid || !state) return false;
  const ref = doc(db, 'users', uid);
  await setDoc(ref, {
    state: JSON.parse(JSON.stringify(state)),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return true;
}

export function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Email hoặc mật khẩu chưa đúng.';
  }
  if (code === 'auth/email-already-in-use') return 'Email này đã được đăng ký rồi.';
  if (code === 'auth/weak-password') return 'Mật khẩu cần ít nhất 6 ký tự.';
  if (code === 'auth/invalid-email') return 'Email không hợp lệ.';
  if (code === 'auth/popup-closed-by-user') return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  if (code === 'auth/unauthorized-domain') return 'Tên miền chưa được cấp quyền trong Firebase Authentication.';
  return err?.message || 'Có lỗi xảy ra, thử lại sau nhé.';
}
