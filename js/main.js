// ===== Khởi động ứng dụng =====
import { initState, subscribe, getState, syncCloudForUser } from './state.js';
import { registerRoute, startRouter, onRoute, currentRoute } from './router.js';
import { renderHeader, refreshHeaderStats, refreshHeaderAuth, setHeaderMascotState } from './components/header.js';
import { renderSidebar, renderBottomNav, setSidebarMascotState } from './components/sidebar.js';
import { mascot } from './mascot.js';
import { onTimer, getTimer, setupDurations } from './timer.js';
import { recomputeStreak } from './gamification.js';
import { pomodoroCompletePopup } from './components/reward.js';
import { toast } from './components/toast.js';
import { onCloudAuthChange } from './cloud.js';
import { mmss } from './utils.js';

import { renderOverview } from './pages/overview.js';
import { renderWeek } from './pages/week.js';
import { renderSubjects } from './pages/subjects.js';
import { renderPomodoro } from './pages/pomodoro.js';
import { renderRoom, disposeRoom } from './pages/room.js';
import { timeOfDay } from './catBrain.js';
import { renderStats } from './pages/stats.js';
import { renderGoals } from './pages/goals.js';
import { renderSettings } from './pages/settings.js';

const main = () => document.getElementById('main');

const PAGES = {
  '/': renderOverview,
  '/week': renderWeek,
  '/subjects': renderSubjects,
  '/pomodoro': renderPomodoro,
  '/room': renderRoom,
  '/stats': renderStats,
  '/goals': renderGoals,
  '/settings': renderSettings,
};

let lastPath = null;
function renderCurrentPage(params) {
  const route = currentRoute();
  const fn = PAGES[route.path] || renderOverview;
  const el = main();
  if (lastPath === '/room' && route.path !== '/room') disposeRoom();
  const isNav = lastPath !== route.path;
  lastPath = route.path;
  const paint = () => {
    el.classList.remove('page-leave');
    fn(el, params || route.params);
    el.classList.remove('page-enter'); void el.offsetWidth;
    el.classList.add('page-enter');
  };
  // Chuyển trang: trang cũ mờ + thu nhất nhẹ → trang mới materialize
  if (isNav && el.children.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('page-leave');
    setTimeout(paint, 140);
  } else paint();
}

/** Khi state đổi: vẽ lại phần cần thiết */
function onStateChange(state, meta) {
  refreshHeaderStats();
  const type = meta.type || '';
  // Những thay đổi nhỏ không cần vẽ lại toàn trang
  if (type === 'coins' || type === 'streak' || type === 'note') return;
  if (type === 'mascot') { renderHeader(); }
  renderSidebar();
  const route = currentRoute();
  // Trang Pomodoro tự quản lý timer; chỉ vẽ lại khi dữ liệu liên quan đổi
  if (route && route.path === '/pomodoro' && !['task-add', 'task-update', 'task-delete', 'task-toggle', 'settings', 'replace', 'pomodoro-complete'].includes(type)) return;
  // Trang Góc học tự đồng bộ qua subscribe riêng (giữ mèo & scene sống), chỉ vẽ lại khi thay thế toàn bộ dữ liệu
  if (route && route.path === '/room' && type !== 'replace') return;
  renderCurrentPage();
  // Hiệu ứng trượt khi đổi ngày trên mobile
  if (meta.slide) {
    const grid = document.getElementById('week-grid');
    if (grid) { grid.classList.add(`slide-${meta.slide}`); setTimeout(() => grid.classList.remove(`slide-${meta.slide}`), 300); }
  }
}

function setupMascotSync() {
  mascot.onChange((state) => {
    setHeaderMascotState(state);
    setSidebarMascotState(state);
    document.querySelectorAll('#pomo-mascot').forEach((el) => { el.className = el.className.replace(/mascot-[\w-]+/g, '') + ` mascot-${state}`; });
  });
  // Trạng thái nền theo giờ
  const tod = timeOfDay();
  if (tod === 'night') mascot.setState('sleepy');
}

function setupTimerPill() {
  const pill = document.getElementById('timer-pill');
  onTimer((tm, evt) => {
    const route = currentRoute();
    const onPomo = route && route.path === '/pomodoro';
    const show = tm.status !== 'idle' && !onPomo;
    pill.hidden = !show;
    if (show) pill.innerHTML = `<span>${tm.mode === 'focus' ? '🍅' : '☕'}</span><strong>${mmss(tm.remaining)}</strong>${tm.status === 'paused' ? '<small>tạm dừng</small>' : ''}`;
  });
  document.addEventListener('pomodoro:complete', (e) => {
    if (e.detail.mode === 'focus') pomodoroCompletePopup(e.detail.minutes, e.detail.coins);
  });
  pill.onclick = () => { location.hash = '/pomodoro'; };
  onRoute(() => {
    const tm = getTimer();
    pill.hidden = tm.status === 'idle' || location.hash.includes('/pomodoro');
  });
}

function setupCloudSync() {
  let lastUid = null;
  onCloudAuthChange(async (user) => {
    refreshHeaderAuth();
    if (!user) {
      lastUid = null;
      return;
    }
    if (user.uid === lastUid) return;
    lastUid = user.uid;
    try {
      const res = await syncCloudForUser(user);
      if (res === 'loaded') toast('Đã đồng bộ dữ liệu từ tài khoản ☁️', { icon: '✓' });
      else if (res === 'uploaded') toast('Đã lưu dữ liệu hiện tại lên tài khoản ☁️', { icon: '✓' });
    } catch (e) {
      console.warn('Lỗi đồng bộ Firebase:', e);
      toast('Đã đăng nhập nhưng chưa đồng bộ được Firestore', { kind: 'error' });
    }
  });
}

function boot() {
  initState();
  recomputeStreak();
  setupDurations();
  renderHeader();
  setupMascotSync();

  for (const p of Object.keys(PAGES)) registerRoute(p, (params) => renderCurrentPage(params));
  onRoute(() => {
    renderSidebar();
    renderBottomNav();
    document.body.classList.remove('drawer-open');
  });
  subscribe(onStateChange);
  setupTimerPill();
  setupCloudSync();

  // Drawer backdrop
  document.getElementById('drawer-backdrop').onclick = () => document.body.classList.remove('drawer-open');

  startRouter();
  document.body.classList.add('ready');
}

boot();
