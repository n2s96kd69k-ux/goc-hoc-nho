import { mergeState, applyAdminCredits, readSyncBase, writeSyncBase } from './sync.js';
// ===== State trung tâm: nguồn dữ liệu duy nhất + pub/sub =====
import { loadState, saveState } from './storage.js';
import { createInitialState, isSampleTask, SIDEBAR_DEFAULT } from './seed.js';
import { debounce, todayKey, startOfWeek, toKey } from './utils.js';
import { migrateRoom } from './room-migration.js';
import { getCurrentUser, loadCloudState, saveCloudState } from './cloud.js';

let state = null;
const listeners = new Set();
const unsavedDrafts = new Map();
let scopeUid = null;
let blocked = false;
let generation = 0;

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

function resetView() {
  state.ui.viewWeek = toKey(startOfWeek(todayKey()));
  state.ui.viewDay = todayKey();
}

export function initState() {
  scopeUid = getCurrentUser()?.uid || null;
  const saved = loadState(scopeUid) || (!scopeUid ? null : loadState());
  state = saved ? migrate(saved) : createInitialState();
  if (scopeUid) state._syncUid = scopeUid;
  resetView();
  return state;
}

export function selectAccountState(user, banned = false, beforeChange = () => {}) {
  const uid = user?.uid || null;
  if (uid === scopeUid && blocked === banned) return;
  const previous = state;
  const mayUseGuest = uid && !scopeUid && !blocked && !previous?._syncUid;
  scopeUid = uid;
  blocked = banned;
  generation++;
  syncedUid = null;
  cloudFailed = false;
  const draft = banned ? null : unsavedDrafts.get(uid);
  const saved = banned ? null : draft || loadState(uid) || (uid ? readSyncBase(uid) : null) || (mayUseGuest ? previous : null);
  state = saved ? migrate(JSON.parse(JSON.stringify(saved))) : createInitialState();
  if (uid && !banned) state._syncUid = uid;
  else delete state._syncUid;
  localFailed = !!draft;
  resetView();
  beforeChange();
  reportSave();
  emit({ type: 'replace' });
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
const persist = () => {
  if (blocked) return false;
  localFailed = !saveState(state);
  const uid = state._syncUid || null;
  if (localFailed) unsavedDrafts.set(uid, state);
  else unsavedDrafts.delete(uid);
  reportSave();
  return !localFailed;
};
export function retrySave() { persist(); persistCloud(); }
const persistCloud = debounce(async () => {
  const user = getCurrentUser();
  if (!user || blocked || scopeUid !== user.uid) return;
  const startedIn = generation;
  if (saving) { saveAgain = true; return; }
  saving = true;
  try {
    if (syncedUid !== user.uid) await syncCloudForUser(user);
    else await saveAndApply(user.uid, startedIn);
    if (startedIn === generation) cloudFailed = false;
  } catch (e) {
    if (startedIn === generation) {
      cloudFailed = true;
      console.warn('Đồng bộ đám mây lỗi:', e);
    }
  }
  finally {
    saving = false;
    reportSave();
    if (saveAgain) { saveAgain = false; persistCloud(); }
  }
}, 1200);

/** Thay đổi state qua hàm mutator, sau đó lưu và thông báo */
export function update(mutator, meta = {}) {
  if (blocked) return false;
  mutator(state);
  persist();
  persistCloud();
  if (!meta.silent) emit(meta);
  return !localFailed;
}

export function replaceState(newState, { skipCloud = false } = {}) {
  if (blocked) return;
  state = migrate(newState);
  if (scopeUid) state._syncUid = scopeUid;
  else delete state._syncUid;
  resetView();
  persist();
  if (!skipCloud) persistCloud();
  emit({ type: 'replace' });
}

export async function syncCloudForUser(user) {
  if (!user || blocked || scopeUid !== user.uid) return null;
  const startedIn = generation;
  if (syncing?.generation === startedIn) return syncing.job;
  const job = (async () => {
    const remote = await loadCloudState(user.uid);
    if (generation !== startedIn || getCurrentUser()?.uid !== user.uid) return null;
    const base = readSyncBase(user.uid);
    // Read local state AFTER the request so edits made while loading survive.
    const local = state;
    // Keep a recoverable copy before the first sync of legacy/unowned data.
    const sameAccount = local._syncUid === user.uid;
    if (remote && !base && (!local._syncUid || sameAccount)) {
      localStorage.setItem('goc-hoc-nho:before-first-sync:' + user.uid, JSON.stringify(local));
    }
    // A new remote profile can inherit guest data, never a different account's data.
    const next = remote
      ? (sameAccount && base ? mergeState(applyAdminCredits(base, remote.wallet?.adminCreditsApplied || 0), applyAdminCredits(local, remote.wallet?.adminCreditsApplied || 0), remote) : remote)
      : (!local._syncUid || sameAccount ? local : createInitialState());
    writeSyncBase(user.uid, remote || next);
    replaceState({ ...next, _syncUid: user.uid }, { skipCloud: true });
    await saveAndApply(user.uid, startedIn);
    if (generation !== startedIn || getCurrentUser()?.uid !== user.uid) return null;
    syncedUid = user.uid;
    return remote ? 'loaded' : 'uploaded';
  })();
  syncing = {generation:startedIn, job};
  try { return await job; } finally { if (syncing?.job === job) syncing = null; }
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


// Apply the committed transaction without overwriting edits made while it ran.
// Timer controls belong to this page; a background save must not restart it.
async function saveAndApply(uid, startedIn) {
  if (startedIn !== generation || blocked || scopeUid !== uid) return;
  const sent = JSON.parse(JSON.stringify(state));
  const committed = await saveCloudState(uid, sent);
  if (startedIn !== generation || !committed || typeof committed !== 'object' || getCurrentUser()?.uid !== uid || state._syncUid !== uid) return;
  const session = state.timer?.session;
  state = migrate(mergeState(sent, state, committed));
  if (session) state.timer.session = session;
  persist();
  emit({ type: 'sync-ack' });
}
