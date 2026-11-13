// ===== Logo trường trên Firebase Storage. 100% chỉ khi link ảnh mở được từ bên ngoài. =====
import { getApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, getMetadata, deleteObject } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import { firebaseApp, getCurrentUser, accountId, OWNER_ID } from './cloud.js';

const KEY = 'ghn_unis';
let cache = [];

export function getUniversities() { return cache; }

export function isAdminUser() {
  const user = getCurrentUser();
  return !!(user && accountId(user.uid) === OWNER_ID);
}

function storage() {
  firebaseApp();
  return getStorage(getApp());
}

function remember(list) {
  const map = new Map();
  for (const u of list || []) {
    if (u && u.id && typeof u.url === 'string' && u.url.startsWith('https://')) {
      map.set(u.id, { id: u.id, name: u.name || 'Trường', url: u.url });
    }
  }
  cache = [...map.values()];
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch {}
  return cache;
}

export async function refreshUniversities() {
  try { remember(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch {}
  try {
    const listed = await listAll(ref(storage(), 'universities'));
    const out = [];
    await Promise.all(listed.items.map(async (item) => {
      const [url, meta] = await Promise.all([getDownloadURL(item), getMetadata(item)]);
      out.push({
        id: item.name.replace(/\.jpg$/i, ''),
        name: (meta.customMetadata && meta.customMetadata.name) || 'Trường',
        url,
      });
    }));
    if (out.length) remember(out);
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
      const max = 128;
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
      }, 'image/jpeg', 0.72);
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Ảnh không hợp lệ')); };
    img.src = blobUrl;
  });
}

function uploadFile(fileRef, blob, name, onProgress) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(fileRef, blob, {
      contentType: 'image/jpeg',
      customMetadata: { name },
    });
    task.on('state_changed', (snap) => {
      const ratio = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0;
      onProgress(Math.min(70, Math.round(20 + ratio * 50)));
    }, (err) => reject(err), () => resolve());
  });
}

async function seenFromOutside(url) {
  const res = await fetch(url, { cache: 'no-store', mode: 'cors' });
  if (!res.ok) throw new Error('Link ảnh chưa mở được từ bên ngoài');
  const blob = await res.blob();
  if (!blob.size) throw new Error('File logo trên Storage đang trống');
  await new Promise((resolve, reject) => {
    const img = new Image();
    const local = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(local); resolve(); };
    img.onerror = () => { URL.revokeObjectURL(local); reject(new Error('Ảnh trên Storage không mở được')); };
    img.src = local;
  });
}

export async function addUniversity(name, file, onProgress = () => {}) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được tải logo.');
  const title = (name || '').trim();
  if (!title) throw new Error('Nhập tên trường.');
  if (!file) throw new Error('Chọn file logo.');
  onProgress(8);
  const blob = await resizeImage(file);
  onProgress(18);
  const id = 'u' + Date.now().toString(36);
  const fileRef = ref(storage(), `universities/${id}.jpg`);
  try {
    await uploadFile(fileRef, blob, title, onProgress);
  } catch (err) {
    const code = err && (err.code || err.message) || '';
    if (String(code).includes('storage/unauthorized') || String(code).includes('storage/unauthenticated')) {
      throw new Error('Storage chưa cho ghi. Dán rules rồi thử lại.');
    }
    if (String(code).includes('storage/bucket-not-found') || String(code).includes('404')) {
      throw new Error('Chưa thấy bucket Storage. Tạo xong hãy tải lại trang.');
    }
    throw new Error(err.message || 'Không tải được lên Storage');
  }
  onProgress(78);
  const url = await getDownloadURL(fileRef);
  onProgress(88);
  await seenFromOutside(url);
  onProgress(100);
  remember([...cache.filter((u) => u.id !== id), { id, name: title, url }]);
  return { id, name: title, url };
}

export async function removeUniversity(id) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được xóa logo.');
  await deleteObject(ref(storage(), `universities/${id}.jpg`));
  remember(cache.filter((u) => u.id !== id));
}
