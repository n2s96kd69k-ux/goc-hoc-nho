// ===== Header gọn =====
import { getState } from '../state.js';
import { mascotSVG, mascot } from '../mascot.js';
import { navigate } from '../router.js';
import { getCurrentUser } from '../cloud.js';
import { openAuthModal } from './authModal.js';
import { escapeHtml } from '../utils.js';

function authButtonText(user) {
  if (!user) return '☁️ Đăng nhập';
  const raw = user.displayName || (user.email ? user.email.split('@')[0] : 'Tài khoản');
  const short = raw.length > 14 ? raw.slice(0, 12) + '…' : raw;
  return `☁️ ${escapeHtml(short)}`;
}

export function renderHeader() {
  const s = getState();
  const user = getCurrentUser();
  const el = document.getElementById('app-header');
  el.innerHTML = `
    <button class="icon-btn menu-btn" id="menu-btn" type="button" aria-label="Ẩn thanh bên" aria-expanded="true" aria-controls="sidebar">☰</button>
    <a class="brand" href="#/" aria-label="Về trang tổng quan">
      <span class="brand-name">🌷 GÓC HỌC NHỎ</span>
      <span class="brand-tag">“Một góc nhỏ cho những ngày cố gắng.”</span>
    </a>
    <div class="header-right">
      <span class="pill glass header-streak" title="Chuỗi cố gắng">🔥 ${s.streak.current} ngày</span>
      <span class="pill glass header-coins" title="Xu của bạn">🪙 ${s.wallet.coins} xu</span>
      <button class="pill glass header-auth" id="auth-btn" type="button" title="Tài khoản & Đồng bộ">${authButtonText(user)}</button>
      <button class="header-mascot mascot-wrap mascot-${mascot.state}" id="header-mascot" type="button" aria-label="Mochi" title="${s.mascot.name}">${mascotSVG(34)}</button>
      <button class="icon-btn" id="settings-btn" type="button" aria-label="Cài đặt">⚙</button>
    </div>`;
  el.querySelector('#settings-btn').onclick = () => navigate('/settings');
  el.querySelector('#auth-btn').onclick = () => openAuthModal();
  el.querySelector('#header-mascot').onclick = () => { mascot.poke(); if (location.hash !== '#/room') navigate('/room'); };
  shownCoins = s.wallet.coins;
  bindSidebarToggle(el.querySelector('#menu-btn'));
}

const SIDEBAR_KEY = 'ghn_sidebar_collapsed';
function isMobileNav() { return window.matchMedia('(max-width: 768px)').matches; }

function bindSidebarToggle(btn) {
  const side = document.getElementById('sidebar');
  if (!isMobileNav() && localStorage.getItem(SIDEBAR_KEY) === '1') {
    document.body.classList.add('sidebar-collapsed');
  }
  const sync = () => {
    const shown = isMobileNav()
      ? document.body.classList.contains('drawer-open')
      : !document.body.classList.contains('sidebar-collapsed');
    btn.setAttribute('aria-expanded', shown ? 'true' : 'false');
    btn.setAttribute('aria-label', shown ? 'Ẩn thanh bên' : 'Hiện thanh bên');
    if (side) side.setAttribute('aria-hidden', shown ? 'false' : 'true');
  };
  sync();
  btn.onclick = () => {
    if (isMobileNav()) document.body.classList.toggle('drawer-open');
    else {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    }
    sync();
  };
}

export function refreshHeaderAuth() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;
  btn.textContent = authButtonText(getCurrentUser());
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
