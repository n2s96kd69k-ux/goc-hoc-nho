// ===== Trang /room : GÓC HỌC CỦA TÔI — Digital Study Room =====
import { getState, subscribe } from '../state.js';
import { escapeHtml } from '../utils.js';
import { CATEGORIES, THEMES, getItemDef, itemsInCategory } from '../items.js';
import {
  buyItem, ownedQty, inventoryList, canBuyMore, placeItem, storeItem, rotateItem, bumpZ,
  undo, redo, canUndo, canRedo, setTheme, unlockedThemes, savePreset, loadPreset, deletePreset,
  setAccessory, toggleLamp, hasLamp, lampOn, setWeather, getPlaced,
} from '../room.js';
import { treeStage, nextTreeThreshold } from '../gamification.js';
import { totalMinutesAllTime } from '../statistics.js';
import { sceneShellHTML, mountScene } from '../components/roomScene.js';
import { openModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { floatCoins, sparkleAt } from '../components/reward.js';
import { sounds } from '../sounds.js';
import { timeOfDay } from '../catBrain.js';

let mode = 'view';       // view | decorate
let panel = 'inventory'; // inventory | shop | style
let shopCat = 'furniture';
let scene = null;
let unsub = null;

const TOD_LABEL = { morning: '🌅 Buổi sáng', day: '☀️ Ban ngày', afternoon: '🌤 Buổi chiều', evening: '🌆 Buổi tối', night: '🌙 Ban đêm' };
const SURF_VI = { floor: 'sàn', wall: 'tường', ceiling: 'trần', desk: 'bàn', shelf: 'kệ', sofa: 'sofa', bed: 'ổ' };
const isMobile = () => matchMedia('(max-width: 768px)').matches;

export function renderRoom(root) {
  disposeRoom();
  const s = getState();

  root.innerHTML = `
    <section class="page room-page ${mode === 'decorate' ? 'is-decorate' : ''}">
      <div class="page-head room-head">
        <div><h1 class="page-title">🏡 GÓC HỌC CỦA TÔI</h1><p class="page-sub">${TOD_LABEL[timeOfDay()]} · Học xong thì về chăm căn phòng nhỏ này nhé.</p></div>
        <div class="room-actions">
          <span class="pill glass big" id="room-coins">🪙 ${s.wallet.coins} xu</span>
          <button type="button" class="btn ${mode === 'decorate' ? 'btn-soft' : 'btn-primary'}" id="toggle-mode">${mode === 'decorate' ? '✓ Xong' : '✨ TRANG TRÍ'}</button>
        </div>
      </div>

      <div class="room-layout">
        <div class="room-stage">
          ${sceneShellHTML()}
          <div class="scene-toolbar glass" id="deco-toolbar" hidden>
            <button type="button" data-tool="undo" title="Hoàn tác" aria-label="Hoàn tác">↶</button>
            <button type="button" data-tool="redo" title="Làm lại" aria-label="Làm lại">↷</button>
            <span class="sep"></span>
            <button type="button" data-tool="lamp" title="Bật/tắt đèn">💡</button>
            <button type="button" data-tool="style" title="Phong cách & thời tiết">🎨</button>
          </div>
          <div class="item-toolbar glass" id="item-toolbar" hidden>
            <span class="item-toolbar-name" id="item-toolbar-name"></span>
            <button type="button" data-act="rotate" title="Xoay">↻</button>
            <button type="button" data-act="up" title="Đưa lên trước">⬆</button>
            <button type="button" data-act="down" title="Đưa ra sau">⬇</button>
            <button type="button" data-act="store" title="Cất vào kho">📦</button>
          </div>
          <p class="scene-hint" id="scene-hint"></p>
        </div>

        <aside class="room-side" id="room-side">
          <div class="paper tree-box" id="tree-box"></div>
          <div class="paper room-panel">
            <div class="tabs">
              <button type="button" class="tab ${panel === 'inventory' ? 'active' : ''}" data-panel="inventory">🎒 Kho</button>
              <button type="button" class="tab ${panel === 'shop' ? 'active' : ''}" data-panel="shop">🎁 Cửa hàng</button>
              <button type="button" class="tab ${panel === 'style' ? 'active' : ''}" data-panel="style">🎨 Phong cách</button>
            </div>
            <div id="panel-body"></div>
          </div>
        </aside>
      </div>
      <button type="button" class="fab glass" id="side-fab" aria-label="Mở kho đồ">🎒</button>
      <div class="sheet-backdrop" id="sheet-backdrop"></div>
    </section>`;

  const sceneEl = root.querySelector('#scene');
  const decoToolbar = root.querySelector('#deco-toolbar');
  const itemToolbar = root.querySelector('#item-toolbar');
  const side = root.querySelector('#room-side');
  const panelBody = root.querySelector('#panel-body');
  const hint = root.querySelector('#scene-hint');
  const setHint = () => { hint.textContent = mode === 'decorate' ? 'Chạm để chọn · Kéo để di chuyển · Kéo đồ từ kho vào phòng' : 'Chạm vào mèo, cửa sổ, đèn hoặc cây để xem điều gì xảy ra 🐾'; };
  setHint();

  // ---------- Scene ----------
  scene = mountScene(sceneEl, {
    getMode: () => mode,
    onSelect: (uid) => showItemToolbar(uid),
    onChange: () => { renderPanel(); renderTree(); updateToolbar(); },
  });
  decoToolbar.hidden = mode !== 'decorate';

  function showItemToolbar(uid) {
    const p = uid && getPlaced(uid);
    if (!p || mode !== 'decorate') { itemToolbar.hidden = true; return; }
    const def = getItemDef(p.itemId);
    itemToolbar.hidden = false;
    itemToolbar.classList.remove('pop'); void itemToolbar.offsetWidth; itemToolbar.classList.add('pop');
    root.querySelector('#item-toolbar-name').textContent = `${def.emoji} ${def.name}`;
    itemToolbar.querySelector('[data-act="rotate"]').disabled = def.rotatable === false;
    const y = p.surface === 'ceiling' ? def.size.h + 4 : Math.max(8, p.y - def.size.h - 5);
    itemToolbar.style.left = `${Math.max(18, Math.min(82, p.x))}%`;
    itemToolbar.style.top = `${y}%`;
  }
  itemToolbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  itemToolbar.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => {
    const uid = scene.selected;
    if (!uid) return;
    const act = b.dataset.act;
    if (act === 'rotate') { const r = rotateItem(uid); if (!r.ok) toast(r.reason, { icon: '🐱' }); else scene.settle(uid); }
    if (act === 'up') bumpZ(uid, 1);
    if (act === 'down') bumpZ(uid, -1);
    if (act === 'store') {
      const r = storeItem(uid);
      if (r.ok) { toast(`📦 Đã cất ${r.def.name} vào kho${r.count > 1 ? ` (+${r.count - 1} món đặt trên)` : ''}`); scene.select(null); }
    }
    scene.refresh(); renderPanel(); updateToolbar();
  });

  decoToolbar.addEventListener('pointerdown', (e) => e.stopPropagation());
  decoToolbar.querySelectorAll('[data-tool]').forEach((b) => b.onclick = () => {
    const t = b.dataset.tool;
    if (t === 'undo') { if (undo()) { toast('↶ Đã hoàn tác'); scene.select(null); } }
    if (t === 'redo') { if (redo()) { toast('↷ Đã làm lại'); scene.select(null); } }
    if (t === 'lamp') { if (!hasLamp()) return toast('Chưa có đèn trong phòng. Ghé Cửa hàng nhé 💡'); const on = toggleLamp(); toast(on ? '💡 Đèn bật' : '🌙 Đèn tắt'); }
    if (t === 'style') { switchPanel('style'); openSheet(); }
    scene.refresh(); renderPanel(); updateToolbar();
  });
  function updateToolbar() {
    decoToolbar.querySelector('[data-tool="undo"]').disabled = !canUndo();
    decoToolbar.querySelector('[data-tool="redo"]').disabled = !canRedo();
    decoToolbar.querySelector('[data-tool="lamp"]').classList.toggle('active', lampOn());
  }

  // ---------- Mode ----------
  function setMode(next) {
    mode = next;
    root.querySelector('.room-page').classList.toggle('is-decorate', mode === 'decorate');
    decoToolbar.hidden = mode !== 'decorate';
    const btn = root.querySelector('#toggle-mode');
    btn.textContent = mode === 'decorate' ? '✓ Xong' : '✨ TRANG TRÍ';
    btn.className = `btn ${mode === 'decorate' ? 'btn-soft' : 'btn-primary'}`;
    setHint();
    if (mode === 'decorate') switchPanel('inventory'); else scene.select(null);
    scene.refresh(); renderPanel();
    if (mode === 'decorate' && isMobile()) openSheet();
  }
  root.querySelector('#toggle-mode').onclick = () => setMode(mode === 'decorate' ? 'view' : 'decorate');

  // ---------- Panels ----------
  function switchPanel(p) {
    panel = p;
    root.querySelectorAll('[data-panel]').forEach((x) => x.classList.toggle('active', x.dataset.panel === p));
    renderPanel();
  }
  root.querySelectorAll('[data-panel]').forEach((t) => t.onclick = () => switchPanel(t.dataset.panel));

  function renderPanel() {
    root.querySelector('#room-coins').textContent = `🪙 ${getState().wallet.coins} xu`;
    if (panel === 'inventory') renderInventory();
    else if (panel === 'shop') renderShop();
    else renderStyle();
  }

  function renderInventory() {
    const list = inventoryList();
    const acc = getState().mascot.accessory;
    if (!list.length && !acc) {
      panelBody.innerHTML = `
        <div class="empty-box">
          <div class="empty-icon">📦</div>
          <strong>KHO ĐỒ ĐANG TRỐNG</strong>
          <p>Hoàn thành phiên tập trung để nhận xu và mở khóa đồ mới.</p>
          <button type="button" class="btn btn-primary btn-sm" data-go="shop">Đi đến Cửa hàng</button>
        </div>`;
      panelBody.querySelector('[data-go]').onclick = () => switchPanel('shop');
      return;
    }
    panelBody.innerHTML = `
      <p class="small muted panel-note">${mode !== 'decorate' ? 'Bật <strong>✨ Trang trí</strong> để kéo đồ vào phòng.' : 'Kéo món đồ thả vào phòng, hoặc bấm “Đặt” để tự tìm chỗ.'}</p>
      <div class="inv-grid">
        ${list.map(({ def, qty }) => `
          <div class="inv-item ${def.accessory ? 'is-acc' : ''}" data-inv="${def.id}">
            <span class="inv-emoji">${def.emoji}</span>
            <span class="inv-name">${escapeHtml(def.name)}</span>
            <span class="inv-qty">×${qty}</span>
            ${def.accessory
              ? `<button type="button" class="btn btn-soft btn-sm" data-wear="${def.id}">Đeo cho mèo</button>`
              : `<button type="button" class="btn btn-soft btn-sm" data-place="${def.id}" ${mode !== 'decorate' ? 'disabled' : ''}>Đặt</button>`}
          </div>`).join('')}
      </div>
      ${acc ? `<button type="button" class="link-btn" data-unwear>Tháo ${getItemDef(acc).name} khỏi mèo</button>` : ''}`;
    panelBody.querySelectorAll('[data-place]').forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const def = getItemDef(b.dataset.place);
      const r = placeItem(def.id);
      if (!r.ok) return toast(r.reason, { icon: '🐱' });
      sounds.plop();
      scene.refresh(); scene.settle(r.placed.uid); scene.select(r.placed.uid);
      toast(`✓ Đã đặt ${def.name} vào phòng`);
      renderPanel(); updateToolbar(); closeSheet();
    });
    panelBody.querySelectorAll('[data-wear]').forEach((b) => b.onclick = () => {
      const def = getItemDef(b.dataset.wear);
      if (setAccessory(def.id).ok) { toast(`${def.emoji} Mochi đeo ${def.name} rồi!`); renderPanel(); }
    });
    const un = panelBody.querySelector('[data-unwear]');
    if (un) un.onclick = () => { setAccessory(null); renderPanel(); };
    // kéo từ kho vào phòng (desktop: kéo ngay; mobile: giữ 300ms)
    panelBody.querySelectorAll('.inv-item:not(.is-acc)').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        if (mode !== 'decorate' || e.target.closest('button')) return;
        const id = el.dataset.inv;
        const startDrag = () => { el.classList.add('dragging-src'); closeSheet(); scene.beginExternalDrag(id, e); };
        if (e.pointerType === 'touch') {
          const t = setTimeout(startDrag, 300);
          const cancel = () => clearTimeout(t);
          el.addEventListener('pointerup', cancel, { once: true });
          el.addEventListener('pointermove', cancel, { once: true });
        } else startDrag();
        window.addEventListener('pointerup', () => el.classList.remove('dragging-src'), { once: true });
      });
    });
  }

  function renderShop() {
    const st = getState();
    panelBody.innerHTML = `
      <div class="cat-tabs">
        ${CATEGORIES.map((c) => `<button type="button" class="chip ${shopCat === c.id ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${c.label}</button>`).join('')}
      </div>
      <div class="shop-grid">
        ${itemsInCategory(shopCat).map((it) => {
          const owned = ownedQty(it.id);
          const can = st.wallet.coins >= it.price;
          const more = canBuyMore(it.id);
          const surf = it.surfaces ? `<small class="shop-surf">${it.surfaces.map((x) => SURF_VI[x]).join(' · ')}</small>` : '';
          const action = !more
            ? `<span class="owned-tag">✓ Đã sở hữu${owned > 1 ? ` ×${owned}` : ''}</span>`
            : `<button type="button" class="btn ${can ? 'btn-primary' : 'btn-ghost'} btn-sm" data-buy="${it.id}" ${can ? '' : 'disabled'}>🪙 ${it.price}</button>${owned ? `<small class="owned-mini">đã có ×${owned}</small>` : ''}`;
          return `<div class="shop-item ${owned ? 'owned' : ''} ${!can && more ? 'locked' : ''}">
            <span class="shop-emoji">${it.emoji}</span>
            <span class="shop-name">${escapeHtml(it.name)}</span>${surf}
            ${action}
          </div>`;
        }).join('')}
      </div>`;
    panelBody.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { shopCat = b.dataset.cat; renderShop(); });
    panelBody.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const def = getItemDef(b.dataset.buy);
      const r = buyItem(def.id);
      if (!r.ok) return toast(r.reason, { icon: '🐱' });
      sounds.plop();
      floatCoins(-def.price, b);
      sparkleAt(b, 5);
      renderPanel();
      if (def.theme) { toast(`🎨 Đã mở khóa & áp dụng ${def.name}`); scene.refresh(); return; }
      if (def.accessory) { toast(`${def.emoji} ${def.name} đã được thêm vào Kho`); return; }
      afterBuyPrompt(def);
    });
  }

  function afterBuyPrompt(def) {
    const m = openModal({
      size: 'sm', hideClose: true,
      content: `<div class="reward-popup">
        <div class="unlock-item">${def.emoji}</div>
        <h2 class="reward-title">${escapeHtml(def.name)} đã vào Kho 🎒</h2>
        <p class="reward-sub">Bạn muốn đặt vào phòng ngay không?</p>
        <div class="btn-row center"><button type="button" class="btn btn-ghost" data-act="keep">Để trong kho</button><button type="button" class="btn btn-primary" data-act="place">Đặt ngay</button></div>
      </div>`,
    });
    m.body.querySelector('[data-act="keep"]').onclick = () => m.close();
    m.body.querySelector('[data-act="place"]').onclick = () => {
      m.close();
      const r = placeItem(def.id);
      if (!r.ok) return toast(r.reason, { icon: '🐱' });
      if (mode !== 'decorate') setMode('decorate');
      scene.refresh(); scene.settle(r.placed.uid); scene.select(r.placed.uid);
      toast(`✓ Đã đặt ${def.name} vào phòng`); renderPanel(); updateToolbar();
    };
  }

  function renderStyle() {
    const r = getState().room;
    const unlocked = new Set(unlockedThemes().map((t) => t.id));
    const presets = r.presets || [];
    panelBody.innerHTML = `
      <h4 class="side-title">🎨 Phong cách phòng</h4>
      <div class="theme-grid">
        ${Object.values(THEMES).map((t) => `<button type="button" class="theme-card ${r.theme === t.id ? 'active' : ''} ${unlocked.has(t.id) ? '' : 'locked'}" data-theme="${t.id}" style="--w:${t.wall};--f:${t.floor};--a:${t.accent}">
          <span class="theme-swatch"><i></i><i></i><i></i></span><span>${t.name}</span>${unlocked.has(t.id) ? '' : '<small>🔒 mua ở Cửa hàng</small>'}
        </button>`).join('')}
      </div>
      <h4 class="side-title mt">📋 Bố cục đã lưu</h4>
      ${presets.length ? `<ul class="preset-list">${presets.map((p) => `<li><span>${escapeHtml(p.name)}</span><span class="btn-row"><button type="button" class="btn btn-soft btn-sm" data-load="${escapeHtml(p.name)}">Áp dụng</button><button type="button" class="icon-btn" data-del="${escapeHtml(p.name)}" aria-label="Xóa">✕</button></span></li>`).join('')}</ul>` : '<p class="small muted">Chưa có bố cục nào. Lưu lại cách bày phòng bạn thích để đổi nhanh.</p>'}
      <form class="inline-form" id="preset-form"><input placeholder="Tên bố cục, vd: Night Study" maxlength="30" required><button class="btn btn-soft btn-sm" type="submit">Lưu</button></form>
      <h4 class="side-title mt">🌦 Thời tiết ngoài cửa sổ</h4>
      <div class="chip-group">${[['auto', 'Tự động'], ['sunny', '☀️ Nắng'], ['cloudy', '☁️ Mây'], ['rain', '🌧 Mưa']].map(([k, l]) => `<button type="button" class="chip ${(r.weather || 'auto') === k ? 'active' : ''}" data-weather="${k}">${l}</button>`).join('')}</div>`;
    panelBody.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => {
      const res = setTheme(b.dataset.theme);
      if (!res.ok) return toast(res.reason || 'Chưa mở khóa', { icon: '🔒' });
      scene.refresh(); renderPanel(); updateToolbar();
    });
    panelBody.querySelector('#preset-form').onsubmit = (e) => { e.preventDefault(); savePreset(e.target.querySelector('input').value.trim()); toast('📋 Đã lưu bố cục'); renderPanel(); };
    panelBody.querySelectorAll('[data-load]').forEach((b) => b.onclick = () => { const res = loadPreset(b.dataset.load); if (res.ok) { toast(res.dropped ? `Đã áp dụng (bỏ qua ${res.dropped} món không còn sở hữu)` : '✓ Đã áp dụng bố cục'); scene.refresh(); updateToolbar(); } });
    panelBody.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => { deletePreset(b.dataset.del); renderPanel(); });
    panelBody.querySelectorAll('[data-weather]').forEach((b) => b.onclick = () => { setWeather(b.dataset.weather); scene.refresh(); renderPanel(); });
  }

  // ---------- Cây tiến độ ----------
  function renderTree() {
    const total = totalMinutesAllTime();
    const tree = treeStage(total);
    const next = nextTreeThreshold(total);
    root.querySelector('#tree-box').innerHTML = `
      <div class="tree-row"><span class="tree-emoji stage-${tree.stage}">${tree.emoji}${tree.double ? tree.emoji : ''}${tree.sparkle ? '<i class="tree-sparkle">✨</i>' : ''}</span>
      <div><h4 class="side-title">🌱 Cây tiến độ</h4><p><strong>${total}</strong> phút học · ${tree.label}</p>
      ${next ? `<div class="bar" style="height:8px"><div class="bar-fill" style="width:${Math.min(100, (total / next) * 100)}%;background:var(--matcha-dark)"></div></div><small class="muted">Còn ${next - total} phút để cây lớn thêm</small>` : '<small class="muted">Cây đã rực rỡ nhất rồi ✨</small>'}</div></div>`;
  }

  // ---------- Mobile bottom sheet ----------
  const backdrop = root.querySelector('#sheet-backdrop');
  function openSheet() { if (!isMobile()) return; side.classList.add('open'); backdrop.classList.add('show'); }
  function closeSheet() { side.classList.remove('open'); backdrop.classList.remove('show'); }
  root.querySelector('#side-fab').onclick = () => (side.classList.contains('open') ? closeSheet() : openSheet());
  backdrop.onclick = closeSheet;

  renderPanel();
  renderTree();
  updateToolbar();

  // Đồng bộ khi state đổi từ nơi khác
  unsub = subscribe((st, meta) => {
    if (!document.body.contains(root) || !scene) return;
    if (meta.type === 'room' || meta.type === 'mascot' || meta.type === 'buy') { scene.refresh(); renderPanel(); updateToolbar(); showItemToolbar(scene.selected); }
    if (meta.type === 'coins') root.querySelector('#room-coins').textContent = `🪙 ${st.wallet.coins} xu`;
    if (meta.type === 'pomodoro-complete') { renderTree(); scene.cat.timerChanged(); }
  });
}

/** Dừng controller mèo & listener khi rời trang */
export function disposeRoom() {
  if (scene) { scene.dispose(); scene = null; }
  if (unsub) { unsub(); unsub = null; }
}
