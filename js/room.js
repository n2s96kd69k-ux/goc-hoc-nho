// ===== ROOM STATE — single source of truth cho Shop / Kho / Phòng / Mèo =====
// state.room = { theme, owned:{itemId:qty}, placed:[{uid,itemId,x,y,surface,parent,rot,zOff}], lampOverride, weather, presets }
import { getState, update } from './state.js';
import { getItemDef, THEMES, isPlaceable, starterRoom } from './items.js';
import { resolvePlacement, findFreeSpot, zIndexOf } from './placement.js';
import { uid as makeUid } from './utils.js';

const room = () => getState().room;

// ---------- Ownership / inventory ----------
export function ownedQty(itemId) { return room().owned[itemId] || 0; }
export function placedCount(itemId) { return room().placed.filter((p) => p.itemId === itemId).length; }
/** Số lượng còn trong kho = sở hữu − đã đặt (− đang đeo với phụ kiện) */
export function inventoryQty(itemId) {
  const def = getItemDef(itemId);
  if (!def) return 0;
  if (def.accessory) return ownedQty(itemId) - (getState().mascot.accessory === itemId ? 1 : 0);
  if (def.theme) return 0;
  return ownedQty(itemId) - placedCount(itemId);
}
export function canBuyMore(itemId) {
  const def = getItemDef(itemId);
  return def && ownedQty(itemId) < (def.maxQty || 1);
}
export function inventoryList() {
  return Object.keys(room().owned)
    .map((id) => ({ def: getItemDef(id), qty: inventoryQty(id), owned: ownedQty(id) }))
    .filter((x) => x.def && !x.def.theme && x.qty > 0);
}
export function placedItems() { return room().placed; }
export function getPlaced(uid) { return room().placed.find((p) => p.uid === uid) || null; }
export function currentTheme() { return THEMES[room().theme] || THEMES.cream; }

// ---------- Kinh tế: mua ----------
export function buyItem(itemId) {
  const def = getItemDef(itemId);
  if (!def) return { ok: false, reason: 'Không tìm thấy vật phẩm.' };
  const s = getState();
  if (!canBuyMore(itemId)) return { ok: false, reason: 'Bạn đã có đủ món này rồi.' };
  if (s.wallet.coins < def.price) return { ok: false, reason: `☕ Chưa đủ xu — còn thiếu ${def.price - s.wallet.coins} xu.` };
  update((st) => {
    st.wallet.coins -= def.price;
    st.room.owned[itemId] = (st.room.owned[itemId] || 0) + 1;
    if (def.theme) st.room.theme = def.theme; // theme: mua = mở khóa + áp dụng
  }, { type: 'buy', itemId });
  return { ok: true, def, coins: getState().wallet.coins };
}

// ---------- Undo / Redo ----------
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 30;
const snapshot = () => JSON.stringify({
  placed: room().placed,
  theme: room().theme,
  accessory: getState().mascot.accessory,
  lampOverride: room().lampOverride ?? null,
  weather: room().weather || 'auto',
});
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
}
function restore(snap) {
  const d = JSON.parse(snap);
  update((st) => {
    st.room.placed = d.placed;
    st.room.theme = d.theme;
    st.mascot.accessory = d.accessory;
    st.room.lampOverride = d.lampOverride ?? null;
    st.room.weather = d.weather || 'auto';
  }, { type: 'room', action: 'history' });
}
export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }
export function undo() { if (!undoStack.length) return false; redoStack.push(snapshot()); restore(undoStack.pop()); return true; }
export function redo() { if (!redoStack.length) return false; undoStack.push(snapshot()); restore(redoStack.pop()); return true; }

// ---------- Đặt / cất / di chuyển ----------
export function placeItem(itemId, px = null, py = null) {
  const def = getItemDef(itemId);
  if (!isPlaceable(def)) return { ok: false, reason: 'Món này không đặt được trong phòng.' };
  if (inventoryQty(itemId) <= 0) return { ok: false, reason: 'Trong kho không còn món này.' };
  let spot;
  if (px == null) {
    spot = findFreeSpot(itemId, room().placed);
    if (!spot) return { ok: false, reason: `Không còn chỗ trống phù hợp cho ${def.name}. Thử dọn bớt hoặc kéo tay nhé.` };
  } else {
    const r = resolvePlacement(itemId, px, py, room().placed);
    if (!r.ok) return { ok: false, reason: r.reason };
    spot = r;
  }
  pushHistory();
  const p = { uid: makeUid(), itemId, x: spot.x, y: spot.y, surface: spot.surface, parent: spot.parent || null, rot: 0, zOff: 0 };
  update((st) => { st.room.placed.push(p); }, { type: 'room', action: 'place', uid: p.uid });
  return { ok: true, placed: p };
}

/** Cất item về kho (không xóa quyền sở hữu). Đồ đặt trên nó cũng bị cất theo. */
export function storeItem(uid) {
  const p = getPlaced(uid);
  if (!p) return { ok: false };
  pushHistory();
  const removedIds = [uid, ...room().placed.filter((q) => q.parent === uid).map((q) => q.uid)];
  update((st) => { st.room.placed = st.room.placed.filter((q) => !removedIds.includes(q.uid)); }, { type: 'room', action: 'store' });
  return { ok: true, count: removedIds.length, def: getItemDef(p.itemId) };
}

/** Preview di chuyển — KHÔNG ghi state */
export function previewMove(uid, px, py) {
  const p = getPlaced(uid);
  if (!p) return { ok: false };
  return resolvePlacement(p.itemId, px, py, room().placed, uid);
}

/** Xác nhận di chuyển. Đồ con (trên bàn/kệ) đi theo. */
export function commitMove(uid, px, py) {
  const p = getPlaced(uid);
  if (!p) return { ok: false };
  const r = resolvePlacement(p.itemId, px, py, room().placed, uid);
  if (!r.ok) return r;
  if (Math.abs(r.x - p.x) < 0.01 && Math.abs(r.y - p.y) < 0.01 && r.surface === p.surface) return { ok: true, unchanged: true };
  pushHistory();
  const dx = r.x - p.x, dy = r.y - p.y;
  update((st) => {
    const t = st.room.placed.find((q) => q.uid === uid);
    t.x = r.x; t.y = r.y; t.surface = r.surface; t.parent = r.parent || null;
    st.room.placed.forEach((c) => { if (c.parent === uid) { c.x += dx; c.y += dy; } });
  }, { type: 'room', action: 'move' });
  return { ok: true };
}

export function rotateItem(uid) {
  const p = getPlaced(uid);
  const def = p && getItemDef(p.itemId);
  if (!p || !def || def.rotatable === false) return { ok: false, reason: 'Món này không xoay được.' };
  pushHistory();
  update((st) => { const t = st.room.placed.find((q) => q.uid === uid); t.rot = t.rot ? 0 : 1; }, { type: 'room', action: 'rotate' });
  return { ok: true };
}

export function bumpZ(uid, dir) {
  const p = getPlaced(uid);
  if (!p) return;
  pushHistory();
  update((st) => { const t = st.room.placed.find((q) => q.uid === uid); t.zOff = Math.max(-3, Math.min(3, (t.zOff || 0) + dir)); }, { type: 'room', action: 'z' });
}

// ---------- Theme / đèn / thời tiết / preset ----------
export function setTheme(themeId) {
  if (!THEMES[themeId]) return { ok: false };
  if (themeId !== 'cream' && !ownedQty('theme_' + themeId)) return { ok: false, reason: 'Bạn chưa mở khóa phong cách này.' };
  pushHistory();
  update((st) => { st.room.theme = themeId; }, { type: 'room', action: 'theme' });
  return { ok: true };
}
export function unlockedThemes() {
  return Object.values(THEMES).filter((t) => t.id === 'cream' || ownedQty('theme_' + t.id) > 0);
}
export function hasLamp() { return room().placed.some((p) => (getItemDef(p.itemId) || {}).lamp); }
export function lampAutoOn() { const h = new Date().getHours(); return h >= 18 || h < 6; }
export function lampOn() {
  if (!hasLamp()) return false;
  const o = room().lampOverride;
  return o === null || o === undefined ? lampAutoOn() : o;
}
export function toggleLamp() {
  if (!hasLamp()) return false;
  const now = lampOn();
  pushHistory();
  update((st) => { st.room.lampOverride = !now; }, { type: 'room', action: 'lamp' });
  return !now;
}
export function setWeather(w) { update((st) => { st.room.weather = w; }, { type: 'room', action: 'weather' }); }

export function savePreset(name) {
  update((st) => {
    st.room.presets = (st.room.presets || []).filter((p) => p.name !== name);
    st.room.presets.push({ name, theme: st.room.theme, placed: JSON.parse(JSON.stringify(st.room.placed)), lampOverride: st.room.lampOverride, savedAt: Date.now() });
    if (st.room.presets.length > 6) st.room.presets.shift();
  }, { type: 'room', action: 'preset' });
}
export function loadPreset(name) {
  const pr = (room().presets || []).find((p) => p.name === name);
  if (!pr) return { ok: false };
  const counts = {};
  const placed = pr.placed.filter((p) => {
    counts[p.itemId] = (counts[p.itemId] || 0) + 1;
    return getItemDef(p.itemId) && counts[p.itemId] <= ownedQty(p.itemId);
  });
  const okUids = new Set(placed.map((p) => p.uid));
  const finalPlaced = placed.filter((p) => !p.parent || okUids.has(p.parent));
  pushHistory();
  update((st) => {
    st.room.placed = finalPlaced;
    if (pr.theme === 'cream' || ownedQty('theme_' + pr.theme)) st.room.theme = pr.theme;
    st.room.lampOverride = pr.lampOverride ?? null;
  }, { type: 'room', action: 'preset' });
  return { ok: true, dropped: pr.placed.length - finalPlaced.length };
}
export function deletePreset(name) {
  update((st) => { st.room.presets = (st.room.presets || []).filter((p) => p.name !== name); }, { type: 'room', action: 'preset' });
}

// ---------- Phụ kiện mèo ----------
export function setAccessory(itemId) {
  if (itemId && !ownedQty(itemId)) return { ok: false, reason: 'Bạn chưa có phụ kiện này.' };
  pushHistory();
  update((st) => { st.mascot.accessory = itemId || null; }, { type: 'mascot' });
  return { ok: true };
}

// ---------- Tiện ích render ----------
export function placedWithMeta() {
  const list = room().placed;
  const byUid = new Map(list.map((p) => [p.uid, p]));
  return list.map((p) => {
    const def = getItemDef(p.itemId);
    const parent = p.parent ? byUid.get(p.parent) : null;
    const parentY = parent ? parent.y : null;
    return { ...p, def, parentY, z: def ? zIndexOf({ ...p, parentY }, def) : 0 };
  }).filter((p) => p.def);
}

/** Migrate dữ liệu phòng cũ (v1: inventory[] + placed[{itemId,x,y}]) → v2 */
export function migrateRoom(s) {
  const base = starterRoom();
  const r = s.room || {};
  if (r.version === 2 && r.owned) {
    return { ...base, ...r, owned: { ...r.owned }, placed: Array.isArray(r.placed) ? r.placed : [], presets: r.presets || [] };
  }
  const alias = { lamp: 'desk_lamp', plant: 'plant_small', flower: 'vase', star: 'star_lamp', bigtree: 'plant_big' };
  const owned = { ...base.owned };
  for (const oldId of (s.inventory || [])) {
    const id = alias[oldId] || oldId;
    if (getItemDef(id)) owned[id] = (owned[id] || 0) + 1;
  }
  const placed = [...base.placed];
  for (const old of (r.placed || [])) {
    const id = alias[old.itemId] || old.itemId;
    const def = getItemDef(id);
    if (!def || !def.size) continue;
    const spot = findFreeSpot(id, placed);
    if (spot) placed.push({ uid: makeUid(), itemId: id, x: spot.x, y: spot.y, surface: spot.surface, parent: spot.parent || null, rot: 0, zOff: 0 });
  }
  if (s.mascot && s.mascot.accessory) {
    const id = alias[s.mascot.accessory] || s.mascot.accessory;
    if (getItemDef(id)) { owned[id] = Math.max(1, owned[id] || 0); s.mascot.accessory = id; }
    else s.mascot.accessory = null;
  }
  return { ...base, owned, placed };
}
