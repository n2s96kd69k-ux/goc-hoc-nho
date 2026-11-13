// ===== PLACEMENT SYSTEM — surfaces, snap, collision, depth =====
// Tọa độ phòng: 100 × 100 (%). Anchor của item = giữa cạnh dưới (x, y).
// Bounding box: [x - w/2, y - h] → [x + w/2, y].
import { getItemDef } from './items.js';

export const ROOM = {
  ceilingY: 6,      // dưới đường này là tường
  floorY: 68,       // đường chân tường (wall/floor)
  wallPad: 4,       // lề trái/phải
  floorMinY: 71,    // anchor floor thấp nhất (gần tường)
  floorMaxY: 97,    // anchor floor gần người xem nhất
  snapRadius: 14,   // khoảng cách tối đa để hút vào surface
};

export function bbox(p, def) {
  const d = def || getItemDef(p.itemId);
  const w = d.size.w, h = d.size.h;
  return { x1: p.x - w / 2, y1: p.y - h, x2: p.x + w / 2, y2: p.y, w, h };
}

/** Đỉnh mặt đặt đồ của một item cung cấp surface (desk/shelf/sofa/bed) */
export function surfaceLineY(parentPlaced) {
  const d = getItemDef(parentPlaced.itemId);
  if (!d || !d.provides) return null;
  const top = parentPlaced.y - d.size.h;
  return top + d.size.h * (d.surfaceTop || 0);
}

/**
 * Liệt kê mọi surface hiện có trong phòng:
 * cố định (floor, wall, ceiling) + do item cung cấp (desk, shelf, sofa, bed).
 */
export function listSurfaces(placed) {
  const out = [
    { type: 'floor', id: 'floor' },
    { type: 'wall', id: 'wall' },
    { type: 'ceiling', id: 'ceiling' },
  ];
  for (const p of placed) {
    const d = getItemDef(p.itemId);
    if (d && d.provides) {
      const b = bbox(p, d);
      out.push({ type: d.provides, id: p.uid, parent: p, x1: b.x1 + 0.5, x2: b.x2 - 0.5, lineY: surfaceLineY(p) });
    }
  }
  return out;
}

/** Vị trí snap của item lên một surface tại điểm trỏ (px, py). Trả về {x, y, dist} hoặc null. */
export function snapToSurface(def, surface, px, py) {
  const w = def.size.w, h = def.size.h;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let x, y;
  switch (surface.type) {
    case 'floor':
      x = clamp(px, ROOM.wallPad + w / 2, 100 - ROOM.wallPad - w / 2);
      y = clamp(py, ROOM.floorMinY, ROOM.floorMaxY);
      break;
    case 'wall':
      x = clamp(px, ROOM.wallPad + w / 2, 100 - ROOM.wallPad - w / 2);
      // đáy item nằm trong [ceiling + h, floorLine - 2]
      y = clamp(py, ROOM.ceilingY + h + 1, ROOM.floorY - 2);
      break;
    case 'ceiling':
      x = clamp(px, ROOM.wallPad + w / 2, 100 - ROOM.wallPad - w / 2);
      y = h; // treo từ trần
      break;
    default: {
      // surface do item cung cấp: đặt trên đường lineY, x trong phạm vi
      const minX = surface.x1 + w / 2, maxX = surface.x2 - w / 2;
      if (minX > maxX) return null; // item quá rộng so với mặt
      x = clamp(px, minX, maxX);
      y = surface.lineY;
    }
  }
  const dist = Math.hypot(px - x, py - y);
  return { x, y, dist };
}

function overlap(a, b, shrink = 0.12) {
  const ax = a.w * shrink, ay = a.h * shrink, bx = b.w * shrink, by = b.h * shrink;
  return a.x1 + ax < b.x2 - bx && a.x2 - ax > b.x1 + bx && a.y1 + ay < b.y2 - by && a.y2 - ay > b.y1 + by;
}

/** Kiểm tra va chạm với item khác trên cùng surface (bỏ qua chính nó & item passable) */
export function collides(candidate, def, placed, ignoreUid = null) {
  if (def.passable) return null;
  const cb = bbox(candidate, def);
  for (const p of placed) {
    if (p.uid === ignoreUid) continue;
    if (p.parent === ignoreUid) continue; // con của item đang di chuyển thì đi theo
    const d = getItemDef(p.itemId);
    if (!d || d.passable) continue;
    if (p.surface !== candidate.surface) continue;
    if (candidate.surface === 'floor' || candidate.surface === 'wall' || candidate.surface === 'ceiling') {
      // trên mặt cố định: chỉ coi là va chạm nếu thật sự chồng lên nhau đáng kể
      if (overlap(cb, bbox(p, d), 0.2)) return p;
    } else if (p.parent === candidate.parent) {
      if (overlap(cb, bbox(p, d), 0.08)) return p;
    }
  }
  return null;
}

/**
 * Điểm ưu tiên trừ vào khoảng cách snap, để chọn đúng "mặt" người dùng nhắm tới.
 *
 * Vấn đề: mọi surface đều tính dist thô tới điểm trỏ. Một cái cây đặt gần bàn
 * có dist ~5 tới mặt bàn nhưng dist 0 tới sàn (vì sàn bị clamp y về floorMinY),
 * nên sàn luôn thắng và không bao giờ đặt được đồ lên bàn.
 *
 * Nguyên tắc:
 *  - Mặt do item cung cấp (mặt bàn, kệ, sofa, ổ mèo): nếu con trỏ đang nằm trên
 *    thân item cha → ưu tiên tuyệt đối (bias rất lớn). Nếu ngoài vùng → phạt vừa.
 *  - Mặt cố định: nếu con trỏ lơ lửng ngoài vùng hợp lệ của nó → phạt mạnh.
 */
function surfaceBias(def, s, px, py) {
  if (s.parent) {
    const pd = getItemDef(s.parent.itemId);
    if (!pd) return 40;
    const top = s.parent.y - pd.size.h;
    const inX = px >= s.x1 - 2 && px <= s.x2 + 2;
    const inY = py >= top - def.size.h && py <= s.parent.y + 2;
    return inX && inY ? -30 : 6;
  }
  switch (s.type) {
    case 'floor':
      // con trỏ còn lơ lửng trên cao (trên mặt sàn) → không phải ý định đặt xuống sàn
      // Còn nếu hợp lệ: sàn hơi kém ưu tiên hơn mặt đồ vật (FLOOR_BIAS)
      return py < ROOM.floorY - 2 ? 20 : FLOOR_BIAS;
    case 'wall':
      return py < ROOM.ceilingY || py > ROOM.floorY ? 20 : 2;
    case 'ceiling':
      return py > 24 ? 20 : 0;
    default:
      return 10;
  }
}

/** Sàn luôn hơi kém ưu tiên hơn mặt đồ vật khi cả hai đều hợp lệ */
const FLOOR_BIAS = 3;

/**
 * Tìm vị trí hợp lệ tốt nhất cho item tại điểm trỏ.
 * @returns {{ok:boolean, x, y, surface, parent, reason}}
 */
export function resolvePlacement(itemId, px, py, placed, ignoreUid = null) {
  const def = getItemDef(itemId);
  if (!def || !def.size) return { ok: false, reason: 'Vật phẩm này không đặt được trong phòng.' };
  const surfaces = listSurfaces(placed).filter((s) => def.surfaces.includes(s.type) && s.id !== ignoreUid);
  if (!surfaces.length) return { ok: false, reason: `Cần có ${surfaceLabel(def.surfaces[0])} để đặt ${def.name}.` };

  let best = null;
  for (const s of surfaces) {
    const snap = snapToSurface(def, s, px, py);
    if (!snap) continue;
    const cand = {
      x: snap.x, y: snap.y, surface: s.type,
      parent: s.parent ? s.parent.uid : null,
      dist: snap.dist + surfaceBias(def, s, px, py),
      surf: s,
    };
    if (!best || cand.dist < best.dist) best = cand;
  }
  if (!best) return { ok: false, reason: 'Không có mặt phẳng phù hợp.' };
  if (best.dist > ROOM.snapRadius) {
    return { ok: false, x: best.x, y: best.y, surface: best.surface, parent: best.parent, reason: `${def.name} chỉ đặt được trên ${def.surfaces.map(surfaceLabel).join(', ')}.` };
  }
  const hit = collides({ ...best, itemId }, def, placed, ignoreUid);
  if (hit) {
    // thử dịch nhẹ sang hai bên để tránh va chạm
    for (const dx of [3, -3, 6, -6, 9, -9]) {
      const alt = best.surf ? snapToSurface(def, best.surf, best.x + dx, best.y) : null;
      if (alt && !collides({ x: alt.x, y: alt.y, surface: best.surface, parent: best.parent, itemId }, def, placed, ignoreUid)) {
        return { ok: true, x: alt.x, y: alt.y, surface: best.surface, parent: best.parent };
      }
    }
    const hitDef = getItemDef(hit.itemId);
    return { ok: false, x: best.x, y: best.y, surface: best.surface, parent: best.parent, reason: `Chỗ này đã có ${hitDef ? hitDef.name : 'món khác'}.` };
  }
  return { ok: true, x: best.x, y: best.y, surface: best.surface, parent: best.parent };
}

/** Tìm chỗ trống tự động cho item (dùng khi bấm "Đặt vào phòng" từ kho) */
export function findFreeSpot(itemId, placed) {
  const def = getItemDef(itemId);
  if (!def || !def.size) return null;
  const probes = [];
  // Ưu tiên surface đầu tiên trong danh sách, quét x từ trái sang phải
  for (const type of def.surfaces) {
    const ys = type === 'floor' ? [82, 90, 76] : type === 'wall' ? [30, 42, 20] : type === 'ceiling' ? [def.size.h] : [null];
    for (const y of ys) for (let x = 10; x <= 90; x += 6) probes.push({ x, y, type });
  }
  for (const pr of probes) {
    const surfaces = listSurfaces(placed).filter((s) => s.type === pr.type);
    for (const s of surfaces) {
      const py = pr.y == null ? s.lineY : pr.y;
      const snap = snapToSurface(def, s, pr.x, py);
      if (!snap || snap.dist > 6) continue;
      const cand = { x: snap.x, y: snap.y, surface: s.type, parent: s.parent ? s.parent.uid : null, itemId };
      if (!collides(cand, def, placed)) return cand;
    }
  }
  return null;
}

/** Z-index theo layer + độ sâu (y). Số càng lớn càng gần người xem. */
export function zIndexOf(p, def) {
  const d = def || getItemDef(p.itemId);
  const z = p.zOff || 0;
  switch (p.surface) {
    case 'ceiling': return 12 + z;
    case 'wall': return 10 + Math.round(p.y * 0.1) + z;
    case 'floor':
      if (d.layer === 'rug') return 20 + z;
      return 30 + Math.round(p.y) + z;
    default:
      // đồ trên desk/shelf/sofa: ngay trước item cha
      return 30 + Math.round(p.parentY || p.y) + 1 + z;
  }
}

/** Z của mèo theo vị trí anchor y trên sàn */
export function catZ(y) { return 30 + Math.round(y); }

export function surfaceLabel(type) {
  return { floor: 'sàn', wall: 'tường', ceiling: 'trần', desk: 'mặt bàn', shelf: 'kệ', sofa: 'sofa', bed: 'ổ mèo' }[type] || type;
}
