// ===== ROOM SCENE 2.5D — nhiều lớp, ánh sáng theo giờ, thời tiết, parallax, kéo thả =====
import { getState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { placedWithMeta, currentTheme, lampOn, previewMove, commitMove, placeItem, toggleLamp, hasLamp } from '../room.js';
import { getItemDef } from '../items.js';
import { catZ, resolvePlacement } from '../placement.js';
import { itemArt } from './itemArt.js';
import { mascotSVG, mascot } from '../mascot.js';
import { timeOfDay, createCatController, CAT_W } from '../catBrain.js';
import { toast } from './toast.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Thời tiết hiệu lực: auto → chọn theo ngày (ổn định trong ngày) */
export function effectiveWeather() {
  const w = getState().room.weather || 'auto';
  if (w !== 'auto') return w;
  const d = new Date();
  const seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
  const r = (seed * 9301 + 49297) % 233280 / 233280;
  return r < 0.55 ? 'sunny' : r < 0.8 ? 'cloudy' : 'rain';
}

/** Markup tĩnh của phòng (các lớp nền). Items & mèo được render riêng. */
export function sceneShellHTML() {
  const t = currentTheme();
  const tod = timeOfDay();
  const weather = effectiveWeather();
  return `
    <div class="scene tod-${tod} weather-${weather} ${lampOn() ? 'lamp-on' : ''}" id="scene"
         style="--wall:${t.wall};--wall2:${t.wall2};--floor:${t.floor};--floor2:${t.floor2};--accent:${t.accent};--curtain:${t.curtain};--desk:${t.desk}">
      <!-- L1 tường -->
      <div class="L L-wall" data-depth="1"><div class="wall-paper"></div><div class="wall-base"></div></div>
      <!-- L2 cửa sổ -->
      <div class="L L-window" data-depth="2">
        <button type="button" class="window" id="eg-window" aria-label="Cửa sổ">
          <div class="sky"><span class="sun"></span><span class="moon"></span><span class="cloud c1"></span><span class="cloud c2"></span><span class="stars"></span></div>
          <div class="rain"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="frame"><i></i><i></i><i></i><i></i></div>
          <div class="sill"></div>
        </button>
        <div class="curtain cl"></div><div class="curtain cr"></div>
        <div class="window-light"></div>
      </div>
      <!-- L3 sàn -->
      <div class="L L-floor" data-depth="2"><div class="floor-board"></div><div class="baseboard"></div></div>
      <!-- L4..L10 items + mèo được render động -->
      <div class="L L-items" id="scene-items" data-depth="3"></div>
      <div class="L L-cat" id="scene-cat-layer" data-depth="4">
        <button type="button" class="room-cat mascot-wrap mascot-idle" id="room-cat" aria-label="Mochi"><span class="cat-shadow"></span>${mascotSVG(100, { seed: 0.3 })}</button>
      </div>
      <!-- lớp ánh sáng tổng -->
      <div class="L L-light" data-depth="0"><div class="ambient"></div><div class="lamp-glow"></div><div class="dust"><i></i><i></i><i></i><i></i><i></i></div></div>
      <!-- ghost khi kéo -->
      <div class="ghost" id="scene-ghost" hidden></div>
      <div class="grid-overlay"></div>
      <div class="scene-empty" id="scene-empty" hidden>🌱<strong>Căn phòng vẫn đang chờ bạn.</strong><span>Mở Kho đồ để bắt đầu trang trí nhé.</span></div>
    </div>`;
}

/** Render các item đã đặt vào lớp items */
export function renderItems(container, { selectedUid = null, decorate = false } = {}) {
  const t = currentTheme();
  const list = placedWithMeta();
  container.innerHTML = list.map((p) => {
    const d = p.def;
    const cls = ['ritem', `layer-${d.layer}`, `surf-${p.surface}`];
    if (d.sway && !REDUCED) cls.push('sway');
    if (d.lamp) cls.push('is-lamp');
    if (d.glow) cls.push('is-glow');
    if (d.steam) cls.push('has-steam');
    if (p.rot) cls.push('flipped');
    if (p.uid === selectedUid) cls.push('selected');
    if (decorate) cls.push('editable');
    const eg = ['clock', 'laptop', 'mug', 'books'].includes(d.art) || d.lamp || d.sway ? 'data-eg="1"' : '';
    return `<div class="${cls.join(' ')}" data-uid="${p.uid}" data-item="${p.itemId}" ${eg}
      style="left:${p.x}%;top:${p.y}%;width:${d.size.w}%;height:${d.size.h}%;z-index:${p.z}" title="${escapeHtml(d.name)}">
      ${itemArt(d, t)}
    </div>`;
  }).join('');
  const empty = container.parentElement.querySelector('#scene-empty');
  if (empty) empty.hidden = list.length > 0;
}

/**
 * Gắn toàn bộ hành vi cho scene: parallax, mèo, easter eggs, kéo thả (khi decorate).
 * Trả về controller { refresh, setMode, select, dispose, cat }.
 */
export function mountScene(sceneEl, { onSelect, onChange, getMode }) {
  const itemsEl = sceneEl.querySelector('#scene-items');
  const ghost = sceneEl.querySelector('#scene-ghost');
  const catEl = sceneEl.querySelector('#room-cat');
  let selected = null;
  let disposed = false;

  // ---------- Mèo ----------
  const cat = createCatController(catEl, {
    onMove: (pos) => { catEl.style.zIndex = catZ(pos.y); catEl.style.width = `${CAT_W}%`; },
  });
  const unsubMascot = mascot.onChange((state) => { catEl.className = `room-cat mascot-wrap mascot-${state}`; });
  catEl.addEventListener('click', (e) => { e.stopPropagation(); mascot.poke(); });
  cat.start();

  // ---------- Parallax (desktop chuột / mobile orientation) ----------
  const layers = [...sceneEl.querySelectorAll('.L[data-depth]')];
  let raf = null, px = 0, py = 0;
  const applyParallax = () => {
    raf = null;
    for (const L of layers) {
      const d = Number(L.dataset.depth) || 0;
      const k = [0, 1.5, 3.5, 5.5, 7][d] || 0;
      L.style.transform = `translate3d(${(px * k).toFixed(1)}px, ${(py * k * 0.6).toFixed(1)}px, 0)`;
    }
  };
  const onMouse = (e) => {
    if (REDUCED) return;
    const r = sceneEl.getBoundingClientRect();
    px = ((e.clientX - r.left) / r.width - 0.5) * 2;
    py = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(applyParallax);
  };
  const onLeave = () => { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(applyParallax); };
  sceneEl.addEventListener('mousemove', onMouse);
  sceneEl.addEventListener('mouseleave', onLeave);
  const onOrient = (e) => {
    if (REDUCED || e.gamma == null) return;
    px = Math.max(-1, Math.min(1, e.gamma / 30));
    py = Math.max(-1, Math.min(1, (e.beta - 45) / 40));
    if (!raf) raf = requestAnimationFrame(applyParallax);
  };
  if (window.DeviceOrientationEvent && matchMedia('(hover: none)').matches) window.addEventListener('deviceorientation', onOrient);

  // ---------- Ánh sáng theo giờ: cập nhật mỗi phút ----------
  const tick = setInterval(() => {
    if (disposed) return;
    sceneEl.className = sceneEl.className.replace(/tod-\w+/, 'tod-' + timeOfDay()).replace(/weather-\w+/, 'weather-' + effectiveWeather());
    sceneEl.classList.toggle('lamp-on', lampOn());
  }, 60000);

  // ---------- Easter eggs & tương tác ----------
  sceneEl.querySelector('#eg-window').addEventListener('click', (e) => {
    e.stopPropagation();
    sceneEl.classList.remove('curtain-wave'); void sceneEl.offsetWidth; sceneEl.classList.add('curtain-wave');
  });
  const toPct = (e) => {
    const r = sceneEl.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  };

  // ---------- Kéo thả (decorate mode) ----------
  let drag = null; // { uid, itemId, fromInventory, startX, startY, moved, el, longPress }
  const showGhost = (def, x, y, ok) => {
    ghost.hidden = false;
    ghost.className = `ghost ${ok ? 'ok' : 'bad'}`;
    ghost.style.left = `${x}%`; ghost.style.top = `${y}%`;
    ghost.style.width = `${def.size.w}%`; ghost.style.height = `${def.size.h}%`;
    if (ghost.dataset.item !== def.id) { ghost.innerHTML = itemArt(def, currentTheme()); ghost.dataset.item = def.id; }
  };
  const hideGhost = () => { ghost.hidden = true; };

  const onPointerDown = (e) => {
    const target = e.target.closest('.ritem');
    const mode = getMode();
    if (!target) {
      if (mode === 'decorate' && !e.target.closest('.room-cat')) { select(null); }
      return;
    }
    e.stopPropagation();
    if (mode !== 'decorate') {
      // View mode: easter egg nhẹ
      if (target.dataset.eg) {
        const def = getItemDef(target.dataset.item);
        if (def.lamp) { const on = toggleLamp(); toast(on ? '💡 Đèn bật' : '🌙 Đèn tắt'); if (onChange) onChange('lamp'); }
        else if (def.art === 'clock') toast(`🕰️ Bây giờ là ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
        else { target.classList.remove('poke'); void target.offsetWidth; target.classList.add('poke'); }
        if (def.catEffect === 'near') mascot.react('interact-look-right', 900);
      }
      return;
    }
    // Decorate: chọn + chuẩn bị kéo (mobile: long-press mới kéo)
    const uid = target.dataset.uid;
    select(uid);
    const start = toPct(e);
    drag = { uid, itemId: target.dataset.item, startX: start.x, startY: start.y, moved: false, el: target, armed: e.pointerType !== 'touch', pointerId: e.pointerId };
    if (!drag.armed) drag.timer = setTimeout(() => { if (drag) { drag.armed = true; target.classList.add('lifting'); if (navigator.vibrate) navigator.vibrate(10); } }, 320);
    target.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag || !drag.armed) return;
    const p = toPct(e);
    if (!drag.moved && Math.hypot(p.x - drag.startX, p.y - drag.startY) < 1) return;
    drag.moved = true;
    drag.el.classList.add('dragging');
    const def = getItemDef(drag.itemId);
    const pv = previewMove(drag.uid, p.x, p.y);
    const gx = pv.x ?? p.x, gy = pv.y ?? p.y;
    showGhost(def, gx, gy, pv.ok);
    drag.last = { ...p, ok: pv.ok, reason: pv.reason };
  };
  const onPointerUp = (e) => {
    if (!drag) return;
    clearTimeout(drag.timer);
    drag.el.classList.remove('dragging', 'lifting');
    const d = drag; drag = null;
    hideGhost();
    if (!d.moved) return;
    const r = commitMove(d.uid, d.last.x, d.last.y);
    if (!r.ok) { toast(r.reason || 'Chỗ này không đặt được', { icon: '🐱' }); refresh(); }
    else { settle(d.uid); if (onChange) onChange('move'); }
  };
  sceneEl.addEventListener('pointerdown', onPointerDown);
  sceneEl.addEventListener('pointermove', onPointerMove);
  sceneEl.addEventListener('pointerup', onPointerUp);
  sceneEl.addEventListener('pointercancel', onPointerUp);

  /** Kéo từ kho vào phòng: gọi từ bên ngoài khi bắt đầu kéo một item kho */
  function beginExternalDrag(itemId, pointerEvent) {
    const def = getItemDef(itemId);
    if (!def || !def.size) return;
    const move = (e) => {
      const p = toPct(e);
      const r = sceneEl.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) { hideGhost(); ext.last = null; return; }
      const pv = resolvePlacement(itemId, p.x, p.y, placedWithMeta()); // preview, không ghi state
      showGhost(def, pv.x ?? p.x, pv.y ?? p.y, pv.ok);
      ext.last = { ...p, ok: pv.ok };
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      hideGhost();
      if (ext.last) {
        const r = placeItem(itemId, ext.last.x, ext.last.y);
        if (!r.ok) toast(r.reason, { icon: '🐱' });
        else { refresh(); settle(r.placed.uid); select(r.placed.uid); toast(`✓ Đã đặt ${def.name} vào phòng`, { icon: def.emoji }); if (onChange) onChange('place'); }
      }
    };
    const ext = { last: null };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    if (pointerEvent) move(pointerEvent);
  }

  function settle(uid) {
    const el = itemsEl.querySelector(`[data-uid="${uid}"]`);
    if (el) { el.classList.remove('settle'); void el.offsetWidth; el.classList.add('settle'); }
  }
  function select(uid) {
    selected = uid;
    itemsEl.querySelectorAll('.ritem').forEach((el) => el.classList.toggle('selected', el.dataset.uid === uid));
    if (onSelect) onSelect(uid);
  }
  function refresh() {
    renderItems(itemsEl, { selectedUid: selected, decorate: getMode() === 'decorate' });
    sceneEl.classList.toggle('lamp-on', lampOn());
    sceneEl.classList.toggle('decorate', getMode() === 'decorate');
    const t = currentTheme();
    for (const [k, v] of Object.entries({ wall: t.wall, wall2: t.wall2, floor: t.floor, floor2: t.floor2, accent: t.accent, curtain: t.curtain, desk: t.desk })) sceneEl.style.setProperty('--' + k, v);
    sceneEl.className = sceneEl.className.replace(/weather-\w+/, 'weather-' + effectiveWeather());
    cat.roomChanged();
  }
  function dispose() {
    disposed = true; cat.dispose(); unsubMascot(); clearInterval(tick);
    sceneEl.removeEventListener('mousemove', onMouse); sceneEl.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('deviceorientation', onOrient);
  }

  refresh();
  return { refresh, select, settle, dispose, cat, beginExternalDrag, get selected() { return selected; } };
}

export { hasLamp };
