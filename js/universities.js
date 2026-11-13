// ===== Logo trường — quản trị viên tải, server xác nhận rồi mới 100% =====
import { doc, getDoc, getDocFromServer, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, getCurrentUser, accountId, OWNER_ID } from './cloud.js';

const KEY = 'ghn_unis';
const SHARED = 'catalog';
let cache = [];

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

function itemsOf(snap) {
  if (!snap || !snap.exists()) return [];
  const data = snap.data() || {};
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.universityCatalog)) return data.universityCatalog;
  return [];
}

export async function refreshUniversities() {
  try { remember(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch {}
  const db = firebaseDb();
  const user = getCurrentUser();
  if (!db) return cache;
  const reads = [
    getDoc(doc(db, 'users', SHARED)),
    getDoc(doc(db, 'catalog', 'universities')),
  ];
  if (user) reads.push(getDoc(doc(db, 'users', user.uid)));
  const settled = await Promise.allSettled(reads);
  const merged = [];
  for (const r of settled) if (r.status === 'fulfilled') merged.push(...itemsOf(r.value));
  return remember(merged.length ? merged : cache);
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 96;
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
      }, 'image/jpeg', 0.68);
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
    img.onerror = () => reject(new Error('Ảnh trên server không mở được'));
    img.src = url;
  });
}

async function writeCatalog(items) {
  const db = firebaseDb();
  const user = getCurrentUser();
  if (!db || !user) throw new Error('Bạn cần đăng nhập.');
  const stamp = Date.now();
  await setDoc(doc(db, 'users', user.uid), {
    universityCatalog: items,
    universityCatalogAt: stamp,
  }, { merge: true });
  const shared = { items, ownerUid: user.uid, updatedAt: stamp };
  const results = await Promise.allSettled([
    setDoc(doc(db, 'users', SHARED), shared),
    setDoc(doc(db, 'catalog', 'universities'), shared),
  ]);
  return results.some((r) => r.status === 'fulfilled');
}

async function seenElsewhere(id) {
  const db = firebaseDb();
  const reads = await Promise.allSettled([
    getDocFromServer(doc(db, 'users', SHARED)),
    getDocFromServer(doc(db, 'catalog', 'universities')),
  ]);
  for (const r of reads) {
    if (r.status !== 'fulfilled') continue;
    const hit = itemsOf(r.value).find((u) => u.id === id);
    if (hit) return hit;
  }
  return null;
}

export async function addUniversity(name, file, onProgress = () => {}) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được tải logo.');
  const title = (name || '').trim();
  if (!title) throw new Error('Nhập tên trường.');
  if (!file) throw new Error('Chọn file logo.');
  onProgress(8);
  const blob = await resizeImage(file);
  onProgress(22);
  const url = await blobToDataUrl(blob);
  const id = 'u' + Date.now().toString(36);
  const item = { id, name: title, url };
  const items = [...cache.filter((u) => u.id !== id), item];
  onProgress(36);
  const shared = await writeCatalog(items);
  onProgress(64);
  if (!shared) throw new Error('Chưa ghi được chỗ dùng chung. Logo chưa hiện cho tài khoản khác.');
  const seen = await seenElsewhere(id);
  onProgress(82);
  if (!seen) throw new Error('Server chưa thấy logo ở chỗ dùng chung.');
  await decodeImage(seen.url);
  onProgress(100);
  remember(items);
  return item;
}

export async function removeUniversity(id) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được xóa logo.');
  const items = cache.filter((u) => u.id !== id);
  const shared = await writeCatalog(items);
  if (!shared) throw new Error('Chưa xóa được trên server dùng chung.');
  remember(items);
}
