// ===== CAT BRAIN — mèo đọc roomState và quyết định hành vi =====
// Mèo KHÔNG hard-code vị trí. Anchor được tính từ item thực sự đang đặt trong phòng.
// Vòng lặp: chọn mục tiêu → walk tới anchor → hành vi tại đó → sau một lúc chọn mục tiêu khác.
import { getState } from './state.js';
import { placedWithMeta, lampOn } from './room.js';
import { getTimer } from './timer.js';
import { mascot } from './mascot.js';
import { ROOM } from './placement.js';

export const CAT_W = 14; // % chiều rộng phòng (mèo là 14 × ~15.4 vì tỉ lệ 100:110)

/** Buổi trong ngày: morning | day | afternoon | evening | night */
export function timeOfDay(h = new Date().getHours()) {
  if (h >= 5 && h < 9) return 'morning';
  if (h >= 9 && h < 15) return 'day';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

/**
 * Danh sách anchor mèo có thể đến, sinh từ item đang đặt.
 * Mỗi anchor: { id, kind, x, y, state, item }
 *  - kind: desk | sofa | bed | plant | shelf | floor
 *  - x,y: anchor chân mèo (giữa cạnh dưới), y trên sàn
 */
export function catAnchors() {
  const placed = placedWithMeta();
  const anchors = [];
  for (const p of placed) {
    const d = p.def;
    if (!d.catEffect) continue;
    const b = { x1: p.x - d.size.w / 2, x2: p.x + d.size.w / 2 };
    switch (d.catEffect) {
      case 'study': // ngồi trước bàn (phía người xem)
        anchors.push({ id: p.uid, kind: 'desk', x: p.x, y: Math.min(ROOM.floorMaxY, p.y + 6), state: 'study', item: p, priority: 3 });
        break;
      case 'rest': // nằm trên sofa
        anchors.push({ id: p.uid, kind: 'sofa', x: p.x, y: p.y - d.size.h * (1 - (d.surfaceTop || 0.45)) + 1, state: 'rest', item: p, priority: 2, onTop: true });
        break;
      case 'sleep': // ngủ trong ổ
        anchors.push({ id: p.uid, kind: 'bed', x: p.x, y: p.y - d.size.h * (1 - (d.surfaceTop || 0.35)) + 1, state: 'sleepy', item: p, priority: 2, onTop: true });
        break;
      case 'near': // đứng cạnh cây / kệ
        if (p.surface === 'floor') anchors.push({ id: p.uid, kind: 'plant', x: b.x2 + CAT_W / 2 + 1, y: p.y, state: 'idle', item: p, priority: 1 });
        else if (p.surface === 'wall') anchors.push({ id: p.uid, kind: 'shelf', x: p.x, y: ROOM.floorMinY + 2, state: 'idle', item: p, priority: 1 });
        break;
      default: break;
    }
  }
  // Điểm sàn mặc định (luôn có) để mèo có thể đi dạo
  anchors.push({ id: 'floor-l', kind: 'floor', x: 22, y: 90, state: 'idle', priority: 0 });
  anchors.push({ id: 'floor-r', kind: 'floor', x: 78, y: 92, state: 'idle', priority: 0 });
  return anchors.filter((a) => a.x > CAT_W / 2 + 2 && a.x < 100 - CAT_W / 2 - 2);
}

/**
 * Quyết định mục tiêu theo ngữ cảnh: timer, giờ, đồ trong phòng.
 * @returns {{anchor, state, reason}}
 */
export function decide(prevId = null) {
  const anchors = catAnchors();
  const tm = getTimer();
  const tod = timeOfDay();
  const pick = (kind) => anchors.find((a) => a.kind === kind);
  const desk = pick('desk'), sofa = pick('sofa'), bed = pick('bed');
  const lamp = lampOn();

  // 1) Pomodoro đang chạy → học tại bàn (nếu có bàn), focus
  if (tm.status === 'running' && tm.mode === 'focus') {
    if (desk) return { anchor: desk, state: 'focus', reason: 'pomodoro' };
    return { anchor: anchors.find((a) => a.kind === 'floor') || anchors[0], state: 'focus', reason: 'pomodoro-no-desk' };
  }
  if (tm.status === 'running' && tm.mode === 'break') {
    if (sofa) return { anchor: sofa, state: 'rest', reason: 'break' };
    return { anchor: anchors.find((a) => a.kind === 'floor') || anchors[0], state: 'idle', reason: 'break' };
  }
  // 2) Ban đêm → ngủ ở ổ / sofa, hoặc học dưới đèn nếu có đèn bật và bàn
  if (tod === 'night') {
    if (bed) return { anchor: bed, state: 'sleepy', reason: 'night-bed' };
    if (lamp && desk) return { anchor: desk, state: 'night', reason: 'night-lamp' };
    if (sofa) return { anchor: sofa, state: 'rest', reason: 'night-sofa' };
    return { anchor: anchors.find((a) => a.kind === 'floor') || anchors[0], state: 'sleepy', reason: 'night' };
  }
  // 3) Tối → học dưới đèn nếu có, không thì nghỉ
  if (tod === 'evening') {
    if (lamp && desk) return { anchor: desk, state: 'study', reason: 'evening-lamp' };
    if (sofa) return { anchor: sofa, state: 'rest', reason: 'evening-sofa' };
  }
  // 4) Ban ngày: luân phiên có trọng số, tránh lặp lại anchor trước
  const options = anchors.filter((a) => a.id !== prevId);
  const weighted = [];
  for (const a of options) {
    const w = a.kind === 'desk' ? 4 : a.kind === 'sofa' ? 2 : a.kind === 'bed' ? 1 : a.kind === 'plant' || a.kind === 'shelf' ? 2 : 1;
    for (let i = 0; i < w; i++) weighted.push(a);
  }
  const a = weighted[Math.floor(Math.random() * weighted.length)] || anchors[0];
  const state = a.kind === 'desk' ? (tod === 'morning' ? 'study' : Math.random() < 0.6 ? 'study' : 'idle') : a.kind === 'sofa' ? 'rest' : a.kind === 'bed' ? 'sleepy' : 'idle';
  return { anchor: a, state, reason: 'roam' };
}

/**
 * Bộ điều khiển mèo trong phòng. Gắn vào một element .room-cat.
 * Tự lập lịch: đến anchor → ở lại 8–20s → chọn anchor khác.
 */
export function createCatController(el, { onMove } = {}) {
  let pos = { x: 50, y: 90 };
  let current = null;
  let timer = null;
  let disposed = false;
  let flip = false;

  const apply = (state) => { mascot.setState(state); };

  function goto(target, state) {
    if (disposed) return;
    const dx = target.x - pos.x;
    const dist = Math.abs(dx);
    const dur = Math.min(2600, Math.max(400, dist * 45)); // ms
    flip = dx < -0.5 ? true : dx > 0.5 ? false : flip;
    el.style.setProperty('--flip', flip ? -1 : 1);
    if (dist > 2) apply('walk');
    el.style.transition = `left ${dur}ms cubic-bezier(.4,.05,.3,1), top ${dur}ms cubic-bezier(.4,.05,.3,1)`;
    el.style.left = `${target.x}%`;
    el.style.top = `${target.y}%`;
    pos = { x: target.x, y: target.y };
    if (onMove) onMove(pos, target);
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (disposed) return;
      apply(state);
      schedule();
    }, dist > 2 ? dur + 80 : 60);
  }

  function schedule() {
    clearTimeout(timer);
    const tm = getTimer();
    // Khi Pomodoro chạy, mèo giữ nguyên tại bàn; kiểm tra lại mỗi 6s
    const wait = tm.status === 'running' ? 6000 : 9000 + Math.random() * 11000;
    timer = setTimeout(tick, wait);
  }

  function tick() {
    if (disposed) return;
    const d = decide(current && current.id);
    const same = current && d.anchor.id === current.id;
    current = d.anchor;
    if (same) { apply(d.state); schedule(); }
    else goto(d.anchor, d.state);
  }

  /** Bắt đầu: đặt ngay tại anchor phù hợp (không animation lần đầu) */
  function start() {
    const d = decide();
    current = d.anchor;
    pos = { x: d.anchor.x, y: d.anchor.y };
    el.style.transition = 'none';
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
    if (onMove) onMove(pos, d.anchor);
    apply(d.state);
    schedule();
  }

  /** Phòng đổi (đặt/cất đồ) → cân nhắc lại ngay */
  function roomChanged() {
    const anchors = catAnchors();
    if (current && !anchors.find((a) => a.id === current.id)) { current = null; tick(); }
    else { clearTimeout(timer); timer = setTimeout(tick, 1200); }
  }

  /** Timer đổi trạng thái → phản ứng ngay */
  function timerChanged() { clearTimeout(timer); timer = setTimeout(tick, 300); }

  return {
    start, roomChanged, timerChanged,
    get position() { return pos; },
    get anchor() { return current; },
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
