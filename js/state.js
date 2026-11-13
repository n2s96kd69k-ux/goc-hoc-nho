// ===== State trung tâm: nguồn dữ liệu duy nhất + pub/sub =====
import { loadState, saveState } from './storage.js';
import { createInitialState, isSampleTask } from './seed.js';
import { debounce, todayKey, startOfWeek, toKey } from './utils.js';
import { migrateRoom } from './room.js';
import { getCurrentUser, loadCloudState, saveCloudState } from './cloud.js';

let state = null;
const listeners = new Set();

function migrate(s) {
  const base = createInitialState();
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
  merged.tasks = Array.isArray(merged.tasks) ? merged.tasks : [];
  if (merged.settings.seeded !== false) {
    merged.tasks = merged.tasks.map((t) => (t && (t.sample || isSampleTask(t)) ? { ...t, sample: true } : t));
  }
  delete merged.inventory;
  return merged;
}

export function initState() {
  const saved = loadState();
  state = saved ? migrate(saved) : createInitialState();
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
  return state;
}

export function getState() { return state; }

const persist = debounce(() => saveState(state), 120);
const persistCloud = debounce(() => {
  const u = getCurrentUser();
  if (u) saveCloudState(u.uid, state).catch((e) => console.warn('Đồng bộ đám mây lỗi:', e));
}, 1200);

export function update(mutator, meta = {}) {
  mutator(state);
  persist();
  persistCloud();
  if (!meta.silent) emit(meta);
}

export function replaceState(newState, { skipCloud = false } = {}) {
  state = migrate(newState);
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
  saveState(state);
  if (!skipCloud) persistCloud();
  emit({ type: 'replace' });
}

export async function syncCloudForUser(user) {
  if (!user) return null;
  const remote = await loadCloudState(user.uid);
  if (remote) {
    replaceState(remote, { skipCloud: true });
    return 'loaded';
  }
  await saveCloudState(user.uid, state);
  return 'uploaded';
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

export function dayRecord(key) {
  if (!state.days[key]) state.days[key] = { minutes: 0, pomodoros: 0, mood: null, note: '' };
  return state.days[key];
}
