// ===== Logo trường trên Firestore (gói Spark, không cần Storage). =====
import { collection, doc, getDocs, getDocFromServer, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, getCurrentUser, accountId, OWNER_ID } from './cloud.js';

const KEY = 'ghn_unis';
let cache = [];
let watching = false;

export function getUniversities() { return cache; }

export function isAdminUser() {
  const user = getCurrentUser();
  return !!(user && accountId(user.uid) === OWNER_ID);
}

function remember(list) {
  const map = new Map();
  for (const u of list || []) {
    if (u && u.id && typeof u.url === 'string' && u.url.startsWith('data:image/')) {
      map.set(u.id, { id: u.id, name: u.name || 'Trường', url: u.url });
    }
  }
  cache = [...map.values()];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  return cache;
}

function fromSnap(snap) {
  return snap.docs.map((d) => ({ id: d.id, name: d.data().name, url: d.data().url }));
}

export async function refreshUniversities() {
  try { remember(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch {}
  const db = firebaseDb();
  if (!db) return cache;
  if (!watching) {
    watching = true;
    onSnapshot(collection(db, 'universities'), (snap) => remember(fromSnap(snap)), () => {});
  }
  try {
    const snap = await getDocs(collection(db, 'universities'));
    remember(fromSnap(snap));
  } catch (e) {
    console.warn(e);
  }
  return cache;
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 256;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(blobUrl);
        if (blob) resolve(blob);
        else reject(new Error('Không xử lý được ảnh'));
      }, 'image/jpeg', 0.78);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Ảnh không hợp lệ')); };
    img.src = blobUrl;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Không đọc được ảnh'));
    r.readAsDataURL(blob);
  });
}

function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Ảnh trên Firestore không mở được'));
    img.src = url;
  });
}

function ruleError(err) {
  const code = String((err && (err.code || err.message)) || '');
  if (code.includes('permission-denied')) return new Error('Chưa có luật universities. Dán luật Firestore rồi Publish.');
  return new Error(err.message || 'Không lưu được logo');
}

export async function addUniversity(name, file, onProgress = () => {}) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được tải logo.');
  const title = (name || '').trim();
  if (!title) throw new Error('Nhập tên trường.');
  if (!file) throw new Error('Chọn file logo.');
  const db = firebaseDb();
  if (!db) throw new Error('Firebase chưa sẵn sàng.');
  onProgress(8);
  const blob = await resizeImage(file);
  onProgress(24);
  const url = await blobToDataUrl(blob);
  const id = 'u' + Date.now().toString(36);
  onProgress(40);
  try {
    await setDoc(doc(db, 'universities', id), { name: title, url, updatedAt: Date.now() });
  } catch (err) {
    throw ruleError(err);
  }
  onProgress(72);
  let saved;
  try {
    saved = await getDocFromServer(doc(db, 'universities', id));
  } catch (err) {
    throw ruleError(err);
  }
  if (!saved.exists() || !saved.data().url) throw new Error('Server chưa thấy logo.');
  onProgress(88);
  await decodeImage(saved.data().url);
  onProgress(100);
  remember([...cache.filter((u) => u.id !== id), { id, name: title, url: saved.data().url }]);
  return { id, name: title, url: saved.data().url };
}

export async function removeUniversity(id) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được xóa logo.');
  const db = firebaseDb();
  try {
    await deleteDoc(doc(db, 'universities', id));
  } catch (err) {
    throw ruleError(err);
  }
  remember(cache.filter((u) => u.id !== id));
}
