// ===== State trung tâm: nguồn dữ liệu duy nhất + pub/sub =====
import { loadState, saveState } from './storage.js';
import { createInitialState } from './seed.js';
import { debounce, todayKey, startOfWeek, toKey } from './utils.js';
import { migrateRoom } from './room.js';

let state = null;
const listeners = new Set();

function migrate(s) {
  const base = createInitialState();
  // Ghép các trường thiếu (giữ nguyên dữ liệu người dùng)
  const merged = { ...base, ...s };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.wallet = { ...base.wallet, ...(s.wallet || {}) };
  merged.streak = { ...base.streak, ...(s.streak || {}) };
  merged.mascot = { ...base.mascot, ...(s.mascot || {}) };
  merged.room = migrateRoom({ ...s, mascot: merged.mascot });
  merged.goal = { ...base.goal, ...(s.goal || {}) };
  merged.timer = { ...base.timer, ...(s.timer || {}) };
  merged.ui = { ...base.ui, ...(s.ui || {}) };
  merged.days = s.days || {};
  delete merged.inventory; // v1 → đã chuyển vào room.owned
  return merged;
}

export function initState() {
  const saved = loadState();
  state = saved ? migrate(saved) : createInitialState();
  // Tuần đang xem luôn reset về tuần hiện tại khi mở app
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
  return state;
}

export function getState() { return state; }

const persist = debounce(() => saveState(state), 120);

/** Thay đổi state qua hàm mutator, sau đó lưu và thông báo */
export function update(mutator, meta = {}) {
  mutator(state);
  persist();
  if (!meta.silent) emit(meta);
}

export function replaceState(newState) {
  state = migrate(newState);
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
  saveState(state);
  emit({ type: 'replace' });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(meta) {
  for (const fn of listeners) {
    try { fn(state, meta); } catch (e) { console.error(e); }
  }
}

/** Lấy hoặc tạo bản ghi ngày */
export function dayRecord(key) {
  if (!state.days[key]) state.days[key] = { minutes: 0, pomodoros: 0, mood: null, note: '' };
  return state.days[key];
}
