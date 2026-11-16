// Three-way merge: retain edits from both devices; local wins a same-field conflict.
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function mergeState(base, local, remote) {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote) && [...local, ...remote].every(v => object(v) && typeof v.id === 'string')) {
    const b = new Map((Array.isArray(base) ? base : []).map(v => [v.id, v]));
    const l = new Map(local.map(v => [v.id, v]));
    const r = new Map(remote.map(v => [v.id, v]));
    return [...new Set([...l.keys(), ...r.keys()])].map(id => mergeState(b.get(id), l.get(id), r.get(id))).filter(v => v !== undefined);
  }
  if (object(local) && object(remote)) {
    const out = {};
    for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local), ...Object.keys(remote)])) {
      const value = mergeState(base?.[key], local[key], remote[key]);
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
