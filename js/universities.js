// ===== Logo trường đại học dùng chung (quản trị viên tải, mọi tài khoản thấy) =====
import { getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, getMetadata, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { firebaseApp, firebaseDb, getCurrentUser, accountId, OWNER_ID } from './cloud.js';

const KEY = 'ghn_unis';
let cache = [];
const listeners = new Set();

export function getUniversities() { return cache; }

export function onUniversities(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  for (const fn of listeners) fn(cache);
}

function remember(list) {
  const map = new Map();
  for (const u of [...cache, ...(list || [])]) {
    if (u && u.id && u.url && (u.url.startsWith('https://') || u.url.startsWith('data:image/'))) map.set(u.id, { id: u.id, name: u.name || 'Trường', url: u.url });
  }
  cache = [...map.values()];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  emit();
  return cache;
}

export function isAdminUser() {
  const user = getCurrentUser();
  return !!(user && accountId(user.uid) === OWNER_ID);
}

function storage() {
  firebaseApp();
  return getStorage(getApp());
}

async function fromStorage() {
  const root = ref(storage(), 'universities');
  const listed = await listAll(root);
  const out = [];
  for (const item of listed.items) {
    try {
      const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)]);
      const id = item.name.replace(/\.jpg$/i, '');
      out.push({ id, name: (meta.customMetadata && meta.customMetadata.name) || 'Trường', url });
    } catch (e) { console.warn(e); }
  }
  return out;
}

async function fromCatalog() {
  const db = firebaseDb();
  if (!db) return [];
  const snap = await getDoc(doc(db, 'catalog', 'universities'));
  return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
}

async function fromOwnDoc() {
  const db = firebaseDb();
  const user = getCurrentUser();
  if (!db || !user) return [];
  const snap = await getDoc(doc(db, 'users', user.uid));
  const items = snap.exists() ? snap.data().universityCatalog : null;
  return Array.isArray(items) ? items : [];
}

export async function refreshUniversities() {
  try { remember(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch {}
  const batches = await Promise.allSettled([fromCatalog(), fromStorage(), fromOwnDoc()]);
  const merged = [];
  for (const b of batches) if (b.status === 'fulfilled') merged.push(...b.value);
  return remember(merged);
}

async function publish(list) {
  const db = firebaseDb();
  if (!db) return;
  const items = list.map(({ id, name, url }) => ({ id, name, url }));
  const user = getCurrentUser();
  if (user) {
    try { await setDoc(doc(db, 'users', user.uid), { universityCatalog: items }, { merge: true }); } catch (e) { console.warn(e); }
  }
  try { await setDoc(doc(db, 'catalog', 'universities'), { items, updatedAt: new Date().toISOString() }); } catch (e) { console.warn(e); }
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const blobUrl = URL.createObjectURL(file);
    img.onload = () => {
      const max = 160;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(blobUrl);
        if (blob) resolve(blob);
        else reject(new Error('Không xử lý được ảnh'));
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Ảnh không hợp lệ')); };
    img.src = blobUrl;
  });
}

export async function addUniversity(name, file) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được tải logo.');
  const title = name.trim();
  if (!title) throw new Error('Nhập tên trường.');
  const blob = await resizeImage(file);
  const id = 'u' + Date.now().toString(36);
  const fileRef = ref(storage(), `universities/${id}.jpg`);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg', customMetadata: { name: title } });
  const url = await getDownloadURL(fileRef);
  const next = remember([...cache.filter((u) => u.id !== id), { id, name: title, url }]);
  await publish(next);
  return next;
}

export async function removeUniversity(id) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được xóa logo.');
  try { await deleteObject(ref(storage(), `universities/${id}.jpg`)); } catch (e) { console.warn(e); }
  cache = cache.filter((u) => u.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  emit();
  await publish(cache);
}
