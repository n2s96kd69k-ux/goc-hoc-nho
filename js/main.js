import { closeSidebarDrawer, startSidebarNavigation } from './components/sidebar-nav.js';
import { startWalletAccount, subscribeServerTasks, subscribeStudyDays, subscribeWallet, walletMode } from './wallet-account.js';
import { exportAccountBackup } from './account-backup.js';
import { startNotifications } from './notifications/data.js';
import { initNotificationUI } from './notifications/ui.js';
import { applyAdminCredits } from './sync.js';
import { renderAdmin, disposeAdmin } from './pages/admin.js';
// ===== Khởi động ứng dụng =====
import { initState, subscribe, getState, syncCloudForUser, selectAccountState, update, retrySave } from './state.js';
import { registerRoute, startRouter, onRoute, currentRoute } from './router.js';
import { renderHeader, refreshHeaderStats, refreshHeaderAuth, setHeaderMascotState } from './components/header.js';
import { renderSidebar, renderBottomNav, setSidebarMascotState } from './components/sidebar.js';
import { mascot } from './mascot.js';
import { onTimer, getTimer, restoreTimer, startTimerAccount } from './timer.js';
import { recomputeStreak } from './gamification.js';
import { pomodoroCompletePopup } from './components/reward.js';
import { toast } from './components/toast.js';
import { closeAllModals } from './components/modal.js';
import { onCloudAuthChange, onAccountAccessChange, getAccountAccess, getCurrentUser, isCurrentAdmin } from './cloud.js';
import { mmss } from './utils.js';

import { patchTaskToggle } from './components/planner.js';
import { renderOverview } from './pages/overview.js';
import { renderWeek } from './pages/week.js';
import { renderSubjects } from './pages/subjects.js';
import { renderPomodoro, disposePomodoro } from './pages/pomodoro.js';
import { renderRoom, disposeRoom } from './pages/room.js';
import { timeOfDay } from './catBrain.js';
import { renderStats } from './pages/stats.js';
import { renderGoals } from './pages/goals.js';
import { renderSettings } from './pages/settings.js';
import { refreshUniversities } from './universities.js';

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
  '/admin': renderAdmin,
};

let lastPath = null;
function renderCurrentPage(params) {
  const route = currentRoute();
  const fn = PAGES[route.path] || renderOverview;
  const el = main();
  document.body.classList.toggle('admin-mode', route.path === '/admin');
  if (lastPath === '/admin' && route.path !== '/admin') disposeAdmin();
  if (lastPath === '/room' && route.path !== '/room') disposeRoom();
  if (lastPath === '/pomodoro' && route.path !== '/pomodoro') disposePomodoro();
  const isNav = lastPath !== route.path;
  const focusPage = isNav && lastPath !== null;
  if (focusPage) closeSidebarDrawer({restoreFocus:false});
  lastPath = route.path;
  const paint = () => {
    if (currentRoute()?.path !== route.path) return;
    el.classList.remove('page-leave');
    fn(el, params || route.params);
    if (focusPage) el.focus({preventScroll:true});
    // Chỉ animate cả trang khi chuyển route. Tick nhiệm vụ không được giật cả bảng tuần.
    if (!isNav) return;
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
  if (currentRoute()?.path === '/admin') return;
  // Những thay đổi nhỏ không cần vẽ lại toàn trang
  if (type === 'coins' || type === 'streak' || type === 'note') return;
  if (type === 'task-toggle') { patchTaskToggle(meta.id); return; }
  if (type === 'task-move') return;
  if (type === 'sidebar-ui') { renderSidebar(); return; }
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
    if (e.detail.mode === 'focus') {
      pomodoroCompletePopup(e.detail.minutes, e.detail.coins);
      const firstAward = e.detail.streakEvents?.[0];
      if (firstAward) toast(`Bạn nhận thêm ${e.detail.streakEvents.reduce((sum, event) => sum + event.coins, 0)} xu từ chuỗi học 🌷`, { icon: '🔥' });
    }
  });
  pill.onclick = () => { location.hash = '/pomodoro'; };
  onRoute(() => {
    const tm = getTimer();
    pill.hidden = tm.status === 'idle' || location.hash.includes('/pomodoro');
  });
}

function setupCloudSync() {
  let uid;
  let banned;
  let sequence = 0;
  const activate = async (user, access) => {
    const nextUid = user?.uid || null;
    const isBanned = !!user && access.uid === nextUid && access.status === 'banned';
    if (uid === nextUid && banned === isBanned) return;
    uid = nextUid;
    banned = isBanned;
    const current = ++sequence;
    selectAccountState(user, isBanned, () => {
      closeAllModals();
      renderHeader();
      if (currentRoute()?.path === '/admin') {
        disposeAdmin();
        main().replaceChildren();
        location.hash = '/';
      }
    });
    refreshHeaderAuth();
    if (!user || isBanned) return;
    try {
      const res = await syncCloudForUser(user);
      if (current !== sequence) return;
      if (res === 'loaded') toast('Đã đồng bộ dữ liệu từ tài khoản ☁️', { icon: '✓' });
      else if (res === 'uploaded') toast('Đã lưu dữ liệu hiện tại lên tài khoản ☁️', { icon: '✓' });
    } catch (e) {
      if (current !== sequence) return;
      console.warn('Lỗi đồng bộ Firebase:', e);
      toast('Đã đăng nhập nhưng chưa đồng bộ được Firestore', { kind: 'error' });
    }
  };
  onAccountAccessChange(access => activate(getCurrentUser(), access));
  onCloudAuthChange(user => activate(user, getAccountAccess()));
}

function setupSaveFeedback() {
  const box = document.createElement('aside');
  box.className = 'save-feedback'; box.hidden = true;
  box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  const retry = document.createElement('button'); retry.type = 'button';
  retry.className = 'btn btn-soft btn-sm'; retry.textContent = 'Thử lưu lại'; retry.onclick = retrySave;
  const backup = document.createElement('button'); backup.type = 'button';
  backup.className = 'btn btn-soft btn-sm'; backup.textContent = 'Tải bản sao';
  backup.onclick = () => {
    try { exportAccountBackup(); }
    catch (error) { toast(error.message, {kind:'error'}); }
  };
  box.append(text, retry, backup); document.body.append(box);
  window.addEventListener('storage:status', ({ detail }) => {
    box.hidden = !detail.localFailed && !detail.cloudFailed;
    text.textContent = detail.localFailed
      ? 'Chưa lưu được trên thiết bị. Hãy tải bản sao để giữ dữ liệu.'
      : 'Đã lưu trên thiết bị, nhưng chưa đồng bộ lên tài khoản. Hãy thử lại khi có mạng.';
  });
}

function boot() {
  setupSaveFeedback();
  initState();
  recomputeStreak();
  renderHeader();
  subscribeWallet(refreshHeaderStats);
  const renderLearningViews = () => {
    refreshHeaderStats();
    renderSidebar();
    if (['/', '/week', '/subjects', '/pomodoro', '/stats'].includes(currentRoute()?.path)) renderCurrentPage();
  };
  subscribeServerTasks(renderLearningViews);
  subscribeStudyDays(renderLearningViews);
  startWalletAccount();
  setupMascotSync();

  for (const p of Object.keys(PAGES)) registerRoute(p, (params) => renderCurrentPage(params));
  onRoute(() => {
    renderSidebar();
    renderBottomNav();
    closeSidebarDrawer({restoreFocus:false});
  });
  subscribe(onStateChange);
  setupTimerPill();
  startTimerAccount();
  setupCloudSync();
  initNotificationUI();
  startNotifications();
  let lastRole = null;
  let settingsContext;
  let bannedNoticeUid = null;
  onAccountAccessChange(access => {
    renderSidebar();
    if (currentRoute()?.path === '/admin' && (!access.uid || access.ready || access.status === 'banned') && !isCurrentAdmin()) {
      disposeAdmin(); main().replaceChildren(); location.hash = '/';
    }
    if (access.ready && access.economyVersion !== 1 && access.uid && getState()._syncUid === access.uid) {
      const adjusted = applyAdminCredits(getState(), access.adminCredits);
      if (adjusted.wallet !== getState().wallet && adjusted.wallet.adminCreditsApplied !== getState().wallet.adminCreditsApplied) {
        // Keep grant bookkeeping in sync even when an adjustment does not change the displayed balance.
        update(s => { s.wallet = applyAdminCredits(s, access.adminCredits).wallet; }, { type: 'coins' });
      }
    }
    if (access.status === 'banned' && bannedNoticeUid !== access.uid) {
      bannedNoticeUid = access.uid;
      toast('Tài khoản đã bị khóa truy cập dữ liệu trên máy chủ.', { kind: 'error' });
    }
    if (lastRole !== access.role && currentRoute()?.path === '/goals') renderCurrentPage();
    const nextSettingsContext = `${access.uid || ''}:${walletMode()}`;
    if (settingsContext !== nextSettingsContext && currentRoute()?.path === '/settings') renderCurrentPage();
    settingsContext = nextSettingsContext;
    lastRole = access.role;
  });

  startSidebarNavigation();
  document.getElementById('skip-link')?.addEventListener('click', event => {
    event.preventDefault();
    main().focus();
  });

  startRouter();
  restoreTimer();
  document.body.classList.add('ready');
  refreshUniversities().then(() => renderSidebar()).catch(() => {});
}

boot();
