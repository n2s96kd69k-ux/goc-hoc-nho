import { mergeState, applyAdminCredits, readSyncBase, writeSyncBase } from './sync.js';
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
  runTransaction,
  onSnapshot,
  getDocFromServer,
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

export function firebaseApp() { return app; }
export function firebaseDb() { return db; }

export function getCurrentUser() {
  return currentUser;
}

const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Mã tài khoản cố định, sinh từ uid Firebase. Mỗi người một mã, không đổi. */
export function accountId(uid) {
  if (!uid) return '';
  let h = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let n = h >>> 0;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ID_ALPHABET[n % ID_ALPHABET.length];
    n = Math.imul(n ^ uid.charCodeAt(i % uid.length), 2246822519) >>> 0;
  }
  return `GHN-${out}`;
}

// Legacy public IDs remain display-only. Authorization comes from users/{Firebase UID}.
export const OWNER_ID = 'GHN-776J9W';
export const OWNER_UID = 'Vyd1sYXrKARaTujn0ucX0XFe0gp2';
let access = { uid: null, role: 'member', status: 'active', owner: false, adminCredits: 0 };
let stopAccess = () => {};
const accessListeners = new Set();
let resolveAuth;
const authReady = new Promise(resolve => { resolveAuth = resolve; });
function publishAccess(next) {
  access = next;
  for (const listener of accessListeners) listener(access);
}
function accessFrom(uid, data = {}, ready = false) {
  return { uid, ready, economyVersion: data.economyVersion === 1 ? 1 : 0, role: uid === OWNER_UID || data.role === 'admin' ? 'admin' : 'member', status: uid !== OWNER_UID && data.status === 'banned' ? 'banned' : 'active', owner: uid === OWNER_UID || data.owner === true, adminCredits: Number.isSafeInteger(data.adminCredits) ? data.adminCredits : 0 };
}
export function getAccountAccess() { return access; }
export function isCurrentAdmin() { return !!currentUser && access.uid === currentUser.uid && access.role === 'admin' && access.status !== 'banned'; }
export function onAccountAccessChange(listener) { accessListeners.add(listener); return () => accessListeners.delete(listener); }
export async function requireAdmin() {
  await authReady;
  const user = currentUser;
  if (!user || !db) return null;
  try {
    const snap = await getDocFromServer(doc(db, 'users', user.uid));
    if (currentUser?.uid !== user.uid) return null;
    publishAccess(accessFrom(user.uid, snap.exists() ? snap.data() : {}, true));
    return isCurrentAdmin() ? user : null;
  } catch { return null; }
}
if (auth) onAuthStateChanged(auth, user => {
  currentUser = user || null;
  stopAccess();
  publishAccess(accessFrom(user?.uid || null));
  resolveAuth();
  if (user) stopAccess = onSnapshot(doc(db, 'users', user.uid), snap => {
    if (currentUser?.uid === user.uid) publishAccess(accessFrom(user.uid, snap.exists() ? snap.data() : {}, true));
  }, error => {
    if (currentUser?.uid === user.uid) publishAccess(accessFrom(user.uid, { status: error.code === 'permission-denied' ? 'banned' : 'active' }));
  });
});
else resolveAuth();

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
  if (uid !== OWNER_UID && data?.status === 'banned') throw new Error('Tài khoản đã bị khóa.');
  return data?.state ? applyAdminCredits(data.state, data.adminCredits || 0) : null;
}

export async function saveCloudState(uid, state) {
  if (!db || !uid || !state) return false;
  if (state._syncUid && state._syncUid !== uid) throw new Error('Dữ liệu thuộc tài khoản khác.');
  const ref = doc(db, 'users', uid);
  const snapshot = JSON.parse(JSON.stringify(state));
  const base = readSyncBase(uid);
  const patch = {
    publicId: accountId(uid),
    state: snapshot,
    updatedAt: new Date().toISOString(),
  };
  const user = getCurrentUser();
  if (user?.uid === uid) Object.assign(patch, {
    displayName: user.displayName || snapshot.settings?.userName || 'Người học',
    email: user.email || '', emailLower: (user.email || '').toLowerCase(), photoURL: user.photoURL || '',
  });
  let committed;
  await runTransaction(db, async (transaction) => {
    const remote = await transaction.get(ref);
    const data = remote.exists() ? remote.data() : {};
    if (uid !== OWNER_UID && data.status === 'banned') throw new Error('Tài khoản đã bị khóa.');
    const existing = data.state || null;
    const credits = data.adminCredits || 0;
    const adjusted = applyAdminCredits(snapshot, credits);
    // An unknown baseline must not silently overwrite an existing account.
    if (existing && !base) throw new Error('Cần tải dữ liệu tài khoản trước khi lưu.');
    committed = existing ? mergeState(applyAdminCredits(base, credits), adjusted, applyAdminCredits(existing, credits)) : adjusted;
    // Replace the reconciled state as a whole so deleted nested fields stay deleted.
    transaction.set(ref, { ...patch, state: committed }, { mergeFields: Object.keys(patch) });
  });
  writeSyncBase(uid, snapshot);
  return committed;
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
