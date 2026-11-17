import { mergeState, applyAdminCredits, readSyncBase, writeSyncBase } from './sync.js';
// ===== State trung tâm: nguồn dữ liệu duy nhất + pub/sub =====
import { loadState, saveState } from './storage.js';
import { createInitialState, isSampleTask, SIDEBAR_DEFAULT } from './seed.js';
import { debounce, todayKey, startOfWeek, toKey } from './utils.js';
import { migrateRoom } from './room.js';
import { getCurrentUser, loadCloudState, saveCloudState } from './cloud.js';

let state = null;
const listeners = new Set();

function migrate(s) {
  const base = createInitialState();
  // Ghép các trường thiếu (giữ nguyên dữ liệu người dùng)
  const merged = { ...base, ...s };
  merged.settings = { ...base.settings, ...(s.settings || {}) };
  merged.settings.sidebar = { ...SIDEBAR_DEFAULT, ...((s.settings && s.settings.sidebar) || {}) };
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

let syncedUid = null;
let syncing = null;
let saving = false;
let saveAgain = false;
let localFailed = false, cloudFailed = false;
function reportSave() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storage:status', { detail: { localFailed, cloudFailed } }));
  }
}
const persist = () => { localFailed = !saveState(state); reportSave(); return !localFailed; };
export function retrySave() { persist(); persistCloud(); }
const persistCloud = debounce(async () => {
  const user = getCurrentUser();
  if (!user) return;
  if (saving) { saveAgain = true; return; }
  saving = true;
  try {
    if (syncedUid !== user.uid) await syncCloudForUser(user);
    else await saveCloudState(user.uid, state);
    cloudFailed = false;
  } catch (e) { cloudFailed = true; console.warn('Đồng bộ đám mây lỗi:', e); }
  finally {
    saving = false;
    reportSave();
    if (saveAgain) { saveAgain = false; persistCloud(); }
  }
}, 1200);

/** Thay đổi state qua hàm mutator, sau đó lưu và thông báo */
export function update(mutator, meta = {}) {
  mutator(state);
  persist();
  persistCloud();
  if (!meta.silent) emit(meta);
  return !localFailed;
}

export function replaceState(newState, { skipCloud = false } = {}) {
  state = migrate(newState);
  const user = getCurrentUser();
  if (user) state._syncUid = user.uid;
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
  persist();
  if (!skipCloud) persistCloud();
  emit({ type: 'replace' });
}

export async function syncCloudForUser(user) {
  if (!user) return null;
  if (syncing) { await syncing; if (syncedUid === user.uid) return 'loaded'; }
  syncedUid = null;
  const job = (async () => {
    const remote = await loadCloudState(user.uid);
    if (getCurrentUser()?.uid !== user.uid) return null;
    const base = readSyncBase(user.uid);
    // Read local state AFTER the request so edits made while loading survive.
    const local = state;
    // Keep a recoverable copy before the first sync of legacy/unowned data.
    if (remote && !base) localStorage.setItem('goc-hoc-nho:before-first-sync:' + user.uid, JSON.stringify(local));
    const sameAccount = local._syncUid === user.uid;
    const next = remote ? (sameAccount && base ? mergeState(applyAdminCredits(base, remote.wallet?.adminCreditsApplied || 0), applyAdminCredits(local, remote.wallet?.adminCreditsApplied || 0), remote) : remote) : local;
    writeSyncBase(user.uid, remote || next);
    replaceState({ ...next, _syncUid: user.uid }, { skipCloud: true });
    await saveCloudState(user.uid, state);
    syncedUid = user.uid;
    return remote ? 'loaded' : 'uploaded';
  })();
  syncing = job;
  try { return await job; } finally { if (syncing === job) syncing = null; }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { syncedUid = null; persistCloud(); });
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
