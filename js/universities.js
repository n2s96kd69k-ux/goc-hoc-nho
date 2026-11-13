// ===== Logo trường trên Firestore (gói Spark, không cần Storage). =====
import { collection, doc, getDocs, getDocFromServer, setDoc, deleteDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, getCurrentUser, accountId, OWNER_ID } from './cloud.js';

const KEY = 'ghn_unis';
const EXAM_KEY = 'ghn_exams';
let cache = [];
let watching = false;
const examListeners = new Set();

export const EXAM_DEFS = [
  { id: 'thpt', name: 'Tốt nghiệp THPT', dates: [] },
  { id: 'vact', name: 'V-ACT (ĐGNL ĐHQG-HCM)', dates: ['2027-03-28', '2027-05-23'] },
  { id: 'hsa', name: 'HSA (ĐGNL ĐHQGHN)', dates: ['2027-03-07', '2027-03-21', '2027-04-04', '2027-04-18', '2027-05-09', '2027-05-23'] },
  { id: 'tsa', name: 'TSA (ĐH Bách Khoa HN)', dates: ['2027-01-16', '2027-03-20', '2027-05-22'] },
  { id: 'vsat', name: 'V-SAT', dates: [] },
];
let exams = EXAM_DEFS.map((e) => ({ id: e.id, name: e.name, dates: [...e.dates] }));

export function getUniversities() { return cache; }

export function getExamSchedule() { return exams; }

export function onExamSchedule(fn) {
  examListeners.add(fn);
  return () => examListeners.delete(fn);
}

function emitExams() {
  for (const fn of examListeners) fn(exams);
}

function applyExams(list) {
  const saved = new Map((list || []).filter((e) => e && e.id).map((e) => [e.id, e]));
  exams = EXAM_DEFS.map((e) => {
    const raw = saved.get(e.id);
    const dates = raw && Array.isArray(raw.dates)
      ? raw.dates.filter((d) => typeof d === 'string' && d).sort()
      : [...e.dates];
    return { id: e.id, name: e.name, dates };
  });
  try { localStorage.setItem(EXAM_KEY, JSON.stringify(exams)); } catch {}
  emitExams();
  return exams;
}

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
  const schedule = snap.docs.find((d) => d.id === 'schedule');
  if (schedule && Array.isArray(schedule.data().exams)) applyExams(schedule.data().exams);
  return snap.docs
    .filter((d) => d.id !== 'schedule')
    .map((d) => ({ id: d.id, name: d.data().name, url: d.data().url }));
}

export async function refreshUniversities() {
  try { remember(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch {}
  try { applyExams(JSON.parse(localStorage.getItem(EXAM_KEY) || 'null') || EXAM_DEFS); } catch {}
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
      const draw = (max) => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/png');
      };
      let max = 1080;
      let url = draw(max);
      while (url.length > 850000 && max > 480) {
        max = Math.round(max * 0.8);
        url = draw(max);
      }
      URL.revokeObjectURL(blobUrl);
      if (url.startsWith('data:image/png')) resolve(url);
      else reject(new Error('Không xử lý được ảnh'));
    };
    img.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error('Ảnh không hợp lệ')); };
    img.src = blobUrl;
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
  const url = await resizeImage(file);
  onProgress(24);
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

export async function saveExamSchedule(dates) {
  if (!isAdminUser()) throw new Error('Chỉ quản trị viên được sửa lịch thi.');
  const db = firebaseDb();
  if (!db) throw new Error('Firebase chưa sẵn sàng.');
  const next = EXAM_DEFS.map((e) => ({
    id: e.id,
    dates: [...new Set((dates[e.id] || []).map((d) => String(d).trim()).filter(Boolean))].sort(),
  }));
  try {
    await setDoc(doc(db, 'universities', 'schedule'), { kind: 'schedule', exams: next, updatedAt: Date.now() });
  } catch (err) {
    throw ruleError(err);
  }
  const saved = await getDocFromServer(doc(db, 'universities', 'schedule'));
  if (!saved.exists() || !Array.isArray(saved.data().exams)) throw new Error('Server chưa thấy lịch thi.');
  return applyExams(saved.data().exams);
}
