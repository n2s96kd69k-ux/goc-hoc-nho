import { getItemDef, starterRoom } from './items.js';
import { findFreeSpot } from './placement.js';
import { uid as makeUid } from './utils.js';

const legacyAliases = { lamp: 'desk_lamp', plant: 'plant_small', flower: 'vase', star: 'star_lamp', bigtree: 'plant_big' };

export function legacyItemId(id) {
  return Object.hasOwn(legacyAliases, id) ? legacyAliases[id] : id;
}

/** Migrate dữ liệu phòng cũ (v1: inventory[] + placed[{itemId,x,y}]) → v2 */
export function migrateRoom(s, nextId = makeUid) {
  const base = starterRoom();
  const r = s.room || {};
  if (r.version === 2 && r.owned) {
    return { ...base, ...r, owned: { ...r.owned }, placed: Array.isArray(r.placed) ? r.placed : [], presets: r.presets || [] };
  }
  const owned = { ...base.owned };
  for (const oldId of (s.inventory || [])) {
    const id = legacyItemId(oldId);
    if (getItemDef(id)) owned[id] = (owned[id] || 0) + 1;
  }
  const placed = [...base.placed];
  for (const old of (r.placed || [])) {
    const id = legacyItemId(old.itemId);
    const def = getItemDef(id);
    if (!def || !def.size) continue;
    const spot = findFreeSpot(id, placed);
    if (spot) placed.push({ uid: nextId(), itemId: id, x: spot.x, y: spot.y, surface: spot.surface, parent: spot.parent || null, rot: 0, zOff: 0 });
  }
  if (s.mascot && s.mascot.accessory) {
    const id = legacyItemId(s.mascot.accessory);
    if (getItemDef(id)) { owned[id] = Math.max(1, owned[id] || 0); s.mascot.accessory = id; }
    else s.mascot.accessory = null;
  }
  return { ...base, owned, placed };
}
