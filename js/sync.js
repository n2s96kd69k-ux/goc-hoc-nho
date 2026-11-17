// Three-way merge: retain edits from both devices; local wins a same-field conflict.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
function mergeValue(base, local, remote) {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote) && [...local, ...remote].every(v => object(v) && typeof v.id === 'string')) {
    const b = new Map((Array.isArray(base) ? base : []).map(v => [v.id, v]));
    const l = new Map(local.map(v => [v.id, v]));
    const r = new Map(remote.map(v => [v.id, v]));
    return [...new Set([...l.keys(), ...r.keys()])].map(id => mergeValue(b.get(id), l.get(id), r.get(id))).filter(v => v !== undefined);
  }
  if (object(local) && object(remote)) {
    const out = {};
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeValue(base?.[key], local[key], remote[key]);
      if (value !== undefined) out[key] = value;
    }
    return out;
  }
  return local;
}
export function readSyncBase(uid) {
  try { return JSON.parse(localStorage.getItem('goc-hoc-nho:sync:' + uid)) || null; }
  catch { return null; }
}
export function writeSyncBase(uid, data) {
  localStorage.setItem('goc-hoc-nho:sync:' + uid, JSON.stringify(data));
}

/** Keep administrator grants separate from the browser's study/reward snapshot. */
export function applyAdminCredits(state, credits = 0) {
  if (!state) return state;
  const wallet = state.wallet || {};
  const applied = Number.isSafeInteger(wallet.adminCreditsApplied) ? wallet.adminCreditsApplied : 0;
  if (!credits && !applied && !Object.hasOwn(wallet, 'adminCreditsApplied')) return state;
  const balance = Number.isSafeInteger(wallet.coins) && wallet.coins >= 0 ? wallet.coins : 0;
  return { ...state, wallet: { ...wallet, coins: Math.max(0, balance + credits - applied), adminCreditsApplied: credits } };
}


// Completed study events are immutable, identified independently of device/time.
// Scalar merge remains appropriate for names/settings, but not additive study totals.
export function mergeState(base, local, remote) {
  const merged = mergeValue(base, local, remote);
  if (!object(local) || !object(remote) || (!local.studyEvents && !remote.studyEvents)) return merged;
  const b = base?.studyEvents || {}, l = local.studyEvents || {}, r = remote.studyEvents || {};
  const fresh = new Map();
  for (const [id, event] of [...Object.entries(l), ...Object.entries(r)]) {
    if (!Object.hasOwn(b, id)) {
      if (fresh.has(id) && !equal(fresh.get(id), event)) throw new Error('Một phiên học có dữ liệu không nhất quán giữa hai thiết bị. Hãy giữ bản sao dữ liệu trước khi đồng bộ lại.');
      fresh.set(id, event);
    }
  }
  if (!fresh.size) return merged;
  const delta = events => {
    const out = new Map();
    for (const [id, event] of Object.entries(events)) {
      if (Object.hasOwn(b, id)) continue;
      for (const [path, amount] of studyEventDeltas(event)) out.set(path, (out.get(path) || 0) + amount);
    }
    return out;
  };
  const dl = delta(l), dr = delta(r), combined = delta(Object.fromEntries(fresh));
  const read = (value, path) => path.reduce((v, key) => v?.[key], value);
  // Do not mutate branches returned by mergeValue's fast paths.
  const out = JSON.parse(JSON.stringify(merged));
  for (const [encoded, amount] of combined) {
    const path = JSON.parse(encoded);
    const bv = read(base, path) || 0;
    const lv = (read(local, path) || 0) - (dl.get(encoded) || 0);
    const rv = (read(remote, path) || 0) - (dr.get(encoded) || 0);
    const residual = mergeValue(bv, lv, rv);
    let target = out;
    for (const key of path.slice(0, -1)) target = target[key] ||= {};
    target[path.at(-1)] = Math.max(0, residual + amount);
  }
  return out;
}

function studyEventDeltas(event) {
  if (!event || !['focus', 'manual'].includes(event.type)
    || !Number.isInteger(event.minutes) || event.minutes < 1 || event.minutes > 1440
    || typeof event.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return [];
  const values = [[['days', event.date, 'minutes'], event.minutes], [['timer', 'totalFocusMinutes'], event.minutes]];
  if (event.type === 'focus') {
    values.push([['days', event.date, 'pomoMinutes'], event.minutes], [['days', event.date, 'pomodoros'], 1], [['timer', 'totalPomodoros'], 1], [['wallet', 'coins'], event.minutes], [['wallet', 'totalEarned'], event.minutes]);
    if (typeof event.subjectId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(event.subjectId)) {
      values.push([['timer', 'bySubject', event.subjectId], event.minutes], [['timer', 'pomosBySubject', event.subjectId], 1]);
    }
  }
  return values.map(([path, amount]) => [JSON.stringify(path), amount]);
}
