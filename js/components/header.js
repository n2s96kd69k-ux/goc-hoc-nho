// ===== Header gọn =====
import { getState } from '../state.js';
import { mascotSVG, mascot } from '../mascot.js';
import { navigate } from '../router.js';
import { getCurrentUser } from '../cloud.js';
import { openAuthModal } from './authModal.js';
import { openModal } from './modal.js';
import { escapeHtml, todayKey } from '../utils.js';
import { streakProgress } from '../gamification.js';

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
    <button class="live-study" id="live-study" type="button" title="Học cùng mọi người ngay!">
      <span class="live-dot" aria-hidden="true"></span>
      <span class="live-copy">Đang có <strong class="live-count" data-live-count>${liveTotal()}</strong> bạn đang học bài</span>
    </button>
    <div class="header-right">
      <button class="pill glass header-streak" id="streak-btn" type="button" title="Xem việc cần làm để giữ chuỗi">🔥 ${s.streak.current} ngày</button>
      <span class="pill glass header-coins" title="Xu của bạn">🪙 ${s.wallet.coins} xu</span>
      <button class="pill glass header-auth" id="auth-btn" type="button" title="Tài khoản & Đồng bộ">${authButtonText(user)}</button>
      <button class="header-mascot mascot-wrap mascot-${mascot.state}" id="header-mascot" type="button" aria-label="Mochi" title="${s.mascot.name}">${mascotSVG(34)}</button>
      <button class="icon-btn" id="settings-btn" type="button" aria-label="Cài đặt">⚙</button>
    </div>`;
  el.querySelector('#settings-btn').onclick = () => navigate('/settings');
  el.querySelector('#streak-btn').onclick = () => openStreakPanel();
  el.querySelector('#live-study').onclick = () => openLiveRoom();
  el.querySelector('#auth-btn').onclick = () => openAuthModal();
  el.querySelector('#header-mascot').onclick = () => { mascot.poke(); if (location.hash !== '#/room') navigate('/room'); };
  shownCoins = s.wallet.coins;
  bindSidebarToggle(el.querySelector('#menu-btn'));
  startLiveCount();
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
let crowdCount = 142;
let liveTimer = null;
let selfStudying = false;

function liveTotal() { return crowdCount + (selfStudying ? 1 : 0); }

function paintLiveCount() {
  const n = String(liveTotal());
  document.querySelectorAll('[data-live-count]').forEach((el) => { el.textContent = n; });
}

function startLiveCount() {
  if (liveTimer) return;
  document.addEventListener('study:presence', (e) => {
    const on = !!(e.detail && e.detail.on);
    if (on === selfStudying) return;
    selfStudying = on;
    paintLiveCount();
  });
  liveTimer = setInterval(() => {
    const step = Math.random() < 0.75 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -2 : 2);
    crowdCount = Math.min(168, Math.max(118, crowdCount + step));
    paintLiveCount();
  }, 15000);
}

function openLiveRoom() {
  const desks = ['Toán', 'Ngữ văn', 'Tiếng Anh', 'Lý', 'Hóa'].map((name, i) => {
    const n = 8 + ((liveTotal() + i * 17) % 28);
    return `<li><span>${name}</span><strong>${n} bạn</strong></li>`;
  }).join('');
  const modal = openModal({
    title: 'Phòng học chung',
    content: `
      <button class="live-study live-study-in" type="button" tabindex="-1">
        <span class="live-dot" aria-hidden="true"></span>
        <span class="live-copy">Đang có <strong class="live-count" data-live-count>${liveTotal()}</strong> bạn đang học bài</span>
      </button>
      <p class="page-sub">Thư viện đang mở. Mọi người học trong yên lặng, bạn có thể vào học cùng.</p>
      <ul class="live-desks">${desks}</ul>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" id="live-join">Học cùng mọi người</button>
      </div>`,
  });
  modal.el.querySelector('#live-join').onclick = () => { modal.close(); navigate('/pomodoro'); };
}
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

function openStreakPanel() {
  const p = streakProgress(todayKey());
  const minLeft = Math.max(0, p.minutesNeed - p.minutes);
  const taskLeft = Math.max(0, p.tasksNeed - p.tasks);
  const minPct = Math.min(100, Math.round((p.minutes / p.minutesNeed) * 100));
  const taskPct = Math.min(100, Math.round((p.tasks / p.tasksNeed) * 100));
  const tasks = taskLeft ? p.todo : [];
  const taskHtml = !taskLeft
    ? '<p class="small muted">Đã xong đủ 3 nhiệm vụ.</p>'
    : tasks.length
      ? `<ul class="streak-tasks">${tasks.map((t) => `<li>${escapeHtml(t.title)}</li>`).join('')}</ul><p class="small muted">Cần hoàn thành thêm ${taskLeft} nhiệm vụ.</p>`
      : '<p class="small muted">Hôm nay chưa có nhiệm vụ. Hãy thêm và hoàn thành đủ 3 việc.</p>';
  const modal = openModal({
    title: p.ok ? 'Hôm nay đã giữ chuỗi' : 'Việc cần làm để giữ chuỗi',
    content: `
      <p class="page-sub">Chuỗi chỉ tăng khi Pomodoro đủ 45 phút và xong 3 nhiệm vụ trong ngày.</p>
      <div class="streak-row"><span>🍅 Pomodoro</span><strong>${p.minutes}/${p.minutesNeed} phút</strong></div>
      <div class="bar"><div class="bar-fill" style="width:${minPct}%"></div></div>
      <p class="small muted">${minLeft ? `Còn ${minLeft} phút Pomodoro.` : 'Đã đủ 45 phút Pomodoro.'}</p>
      <div class="streak-row"><span>✓ Nhiệm vụ</span><strong>${Math.min(p.tasks, p.tasksNeed)}/${p.tasksNeed}</strong></div>
      <div class="bar"><div class="bar-fill" style="width:${taskPct}%"></div></div>
      ${taskHtml}
      <div class="modal-actions">
        <button class="btn btn-soft" type="button" id="streak-pomo">Đi Pomodoro</button>
        <button class="btn btn-primary" type="button" id="streak-plan">Xem kế hoạch</button>
      </div>`,
  });
  modal.el.querySelector('#streak-pomo').onclick = () => { modal.close(); navigate('/pomodoro'); };
  modal.el.querySelector('#streak-plan').onclick = () => { modal.close(); navigate('/'); };
}
