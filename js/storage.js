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
export function exportToFile(state) {
  const payload = { app: 'goc-hoc-nho', version: 1, exportedAt: new Date().toISOString(), data: state };
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
export function parseImportFile(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('File không phải JSON hợp lệ.'); }
  const data = parsed && parsed.app === 'goc-hoc-nho' ? parsed.data : parsed;
  if (!data || typeof data !== 'object') throw new Error('Cấu trúc dữ liệu không đúng.');
  const required = ['tasks', 'subjects', 'days', 'wallet'];
  for (const k of required) {
    if (!(k in data)) throw new Error(`Thiếu trường "${k}" trong dữ liệu.`);
  }
  if (!Array.isArray(data.tasks) || !Array.isArray(data.subjects)) throw new Error('tasks/subjects phải là danh sách.');
  return data;
}
