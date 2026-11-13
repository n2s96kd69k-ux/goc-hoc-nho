// ===== Tiện ích dùng chung =====

export const DAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
export const DAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const DAY_ICONS = ['🌱', '📖', '✏️', '🍵', '🌷', '🎈', '☁️'];
export const DAY_COLORS = ['matcha', 'sky', 'lavender', 'butter', 'peach', 'mint', 'rose'];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const pad = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' theo giờ địa phương */
export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 'YYYY-MM-DD' -> Date (local midnight) */
export function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function todayKey() { return toKey(new Date()); }

export function addDays(dateOrKey, n) {
  const d = typeof dateOrKey === 'string' ? fromKey(dateOrKey) : new Date(dateOrKey);
  d.setDate(d.getDate() + n);
  return d;
}

/** Thứ 2 của tuần chứa ngày này */
export function startOfWeek(dateOrKey) {
  const d = typeof dateOrKey === 'string' ? fromKey(dateOrKey) : new Date(dateOrKey);
  const dow = (d.getDay() + 6) % 7; // 0 = Thứ 2
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 7 key ngày của tuần bắt đầu từ monday */
export function weekKeys(monday) {
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(monday, i)));
}

export function formatDM(key) {
  const d = fromKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}
export function formatDMY(key) {
  const d = fromKey(key);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function weekRangeLabel(monday) {
  const a = monday, b = addDays(monday, 6);
  return `${pad(a.getDate())} – ${pad(b.getDate())} / ${pad(b.getMonth() + 1)}`;
}
export function dayLabelOf(key) {
  const d = fromKey(key);
  return DAY_LABELS[(d.getDay() + 6) % 7];
}

export function minutesToText(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}
export function mmss(sec) {
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

export function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function daysBetween(fromKeyStr, toKeyStr) {
  const a = fromKey(fromKeyStr), b = fromKey(toKeyStr);
  return Math.round((b - a) / 86400000);
}

/** Tạo element từ chuỗi HTML */
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export const MOODS = [
  { id: 'tired', emoji: '😴', label: 'Mệt' },
  { id: 'normal', emoji: '🙂', label: 'Bình thường' },
  { id: 'good', emoji: '😊', label: 'Ổn' },
  { id: 'fire', emoji: '🔥', label: 'Tràn đầy năng lượng' },
];

export const PRIORITIES = [
  { id: 'low', label: 'Nhẹ nhàng', dot: '🟢' },
  { id: 'medium', label: 'Bình thường', dot: '🟡' },
  { id: 'high', label: 'Quan trọng', dot: '🌷' },
];
