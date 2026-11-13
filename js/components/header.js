// ===== Header gọn =====
import { getState } from '../state.js';
import { mascotSVG, mascot } from '../mascot.js';
import { navigate } from '../router.js';

export function renderHeader() {
  const s = getState();
  const el = document.getElementById('app-header');
  el.innerHTML = `
    <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Mở menu">☰</button>
    <a class="brand" href="#/" aria-label="Về trang tổng quan">
      <span class="brand-name">🌷 GÓC HỌC NHỎ</span>
      <span class="brand-tag">“Một góc nhỏ cho những ngày cố gắng.”</span>
    </a>
    <div class="header-right">
      <span class="pill glass header-streak" title="Chuỗi cố gắng">🔥 ${s.streak.current} ngày</span>
      <span class="pill glass header-coins" title="Xu của bạn">🪙 ${s.wallet.coins} xu</span>
      <button class="header-mascot mascot-wrap mascot-${mascot.state}" id="header-mascot" type="button" aria-label="Mochi" title="${s.mascot.name}">${mascotSVG(34)}</button>
      <button class="icon-btn" id="settings-btn" type="button" aria-label="Cài đặt">⚙</button>
    </div>`;
  el.querySelector('#settings-btn').onclick = () => navigate('/settings');
  el.querySelector('#header-mascot').onclick = () => { mascot.poke(); if (location.hash !== '#/room') navigate('/room'); };
  shownCoins = s.wallet.coins;
  el.querySelector('#menu-btn').onclick = () => document.body.classList.toggle('drawer-open');
}

let shownCoins = null;
let coinRaf = null;
/** Cập nhật nhanh xu/chuỗi — số xu đếm mượt tới giá trị mới */
export function refreshHeaderStats() {
  const s = getState();
  const c = document.querySelector('.header-coins');
  const st = document.querySelector('.header-streak');
  if (st) st.textContent = `🔥 ${s.streak.current} ngày`;
  if (!c) return;
  const target = s.wallet.coins;
  if (shownCoins === null || matchMedia('(prefers-reduced-motion: reduce)').matches) { shownCoins = target; c.textContent = `🪙 ${target} xu`; return; }
  if (shownCoins === target) return;
  cancelAnimationFrame(coinRaf);
  const from = shownCoins, t0 = performance.now(), dur = 520;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - k, 3);
    shownCoins = Math.round(from + (target - from) * e);
    c.textContent = `🪙 ${shownCoins} xu`;
    if (k < 1) coinRaf = requestAnimationFrame(step);
  };
  coinRaf = requestAnimationFrame(step);
}

export function setHeaderMascotState(state) {
  const el = document.getElementById('header-mascot');
  if (!el) return;
  el.className = `header-mascot mascot-wrap mascot-${state}`;
}
