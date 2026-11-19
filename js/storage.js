// ===== Lưu trữ: localStorage (đồng bộ, nhanh, đủ cho dữ liệu planner) =====
// Dữ liệu được lưu dưới một key duy nhất, có version để dễ migrate sau này.

const KEY = 'goc-hoc-nho:v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) {
    console.warn('Không đọc được dữ liệu đã lưu', e);
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('Không lưu được dữ liệu', e);
    return false;
  }
}

export function clearState() {
  localStorage.removeItem(KEY);
}

/** Xuất ra file JSON */
export function exportToFile(state, { reference = false } = {}) {
  const payload = { app: 'goc-hoc-nho', version: 1, exportedAt: new Date().toISOString(),
    ...(reference ? { kind:'server-wallet-reference' } : {}), data: state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `goc-hoc-nho-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Đọc & kiểm tra file JSON nhập vào. Trả về state hợp lệ hoặc ném lỗi. */
export function parseImportFile(text, { allowReference = false } = {}) {
  if (typeof text !== 'string' || text.length > 5 * 1024 * 1024) throw new Error('File vượt quá giới hạn 5 MB.');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('File không phải JSON hợp lệ.'); }
  if (parsed?.app === 'goc-hoc-nho' && parsed.kind === 'server-wallet-reference' && !allowReference) {
    throw new Error('Bản sao từ ví máy chủ chỉ dùng để đối chiếu hoặc nhập lại cài đặt trong tài khoản đã chuyển.');
  }
  const data = parsed && parsed.app === 'goc-hoc-nho' ? parsed.data : parsed;
  if (!data || typeof data !== 'object') throw new Error('Cấu trúc dữ liệu không đúng.');
  const required = ['tasks', 'subjects', 'days', 'wallet'];
  for (const k of required) {
    if (!(k in data)) throw new Error(`Thiếu trường "${k}" trong dữ liệu.`);
  }
  if (!Array.isArray(data.tasks) || !Array.isArray(data.subjects)) throw new Error('tasks/subjects phải là danh sách.');
  validateImportData(data);
  return data;
}

function validateImportData(data) {
  const fail = () => { throw new Error('Dữ liệu sao lưu sai kiểu hoặc chứa nội dung không an toàn.'); };
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
  let nodes = 0;
  function walk(value, depth = 0) {
    if (++nodes > 200000 || depth > 30) fail();
    if (typeof value === 'string' && (value.length > 100000 || /[<>]/.test(value))) fail();
    if (typeof value === 'number' && !Number.isFinite(value)) fail();
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail();
      walk(child, depth + 1);
    }
  }
  walk(data);
  if (!record(data.days) || !record(data.wallet) || !number(data.wallet.coins)) fail();
  if (data.wallet.totalEarned !== undefined && !number(data.wallet.totalEarned)) fail();
  const ids = new Set();
  for (const task of data.tasks) {
    if (!record(task) || typeof task.id !== 'string' || !/^[\w-]{1,100}$/.test(task.id) || ids.has(task.id)
      || typeof task.title !== 'string' || typeof task.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)
      || typeof task.done !== 'boolean') fail();
    ids.add(task.id);
    for (const key of ['minutes', 'pomodoros']) if (task[key] !== undefined && !number(task[key])) fail();
  }
  ids.clear();
  for (const subject of data.subjects) {
    if (!record(subject) || typeof subject.id !== 'string' || !/^[\w-]{1,100}$/.test(subject.id) || ids.has(subject.id)
      || typeof subject.name !== 'string' || typeof subject.icon !== 'string'
      || typeof subject.color !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(subject.color)) fail();
    ids.add(subject.id);
    if (subject.chapters !== undefined && (!Array.isArray(subject.chapters) || !subject.chapters.every(v => typeof v === 'string'))) fail();
    if (subject.scores !== undefined && (!Array.isArray(subject.scores) || !subject.scores.every(v => record(v) && number(v.score)))) fail();
  }
  for (const [date, day] of Object.entries(data.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !record(day)) fail();
    for (const key of ['minutes', 'pomodoros', 'pomoMinutes']) if (day[key] !== undefined && !number(day[key])) fail();
  }
  for (const key of ['settings', 'room', 'timer', 'goal', 'mascot', 'streak', 'ui']) if (data[key] !== undefined && !record(data[key])) fail();
  if (data.settings) for (const [key, max] of [['focusMinutes', 180], ['breakMinutes', 60]]) {
    const value = data.settings[key];
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > max)) fail();
  }
}
