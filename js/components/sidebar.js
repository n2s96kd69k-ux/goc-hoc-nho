// ===== Sidebar: lịch tháng, tiến độ tuần, thời gian, mục tiêu, mascot, navigation =====
import { getState, update } from '../state.js';
import { DAY_SHORT, fromKey, toKey, startOfWeek, minutesToText, todayKey, daysBetween, escapeHtml } from '../utils.js';
import { weekSummary } from '../statistics.js';
import { calendarHTML, bindCalendar } from './calendar.js';
import { progressBar } from './progressRing.js';
import { mascotSVG, mascot, mascotMessage } from '../mascot.js';
import { navigate, currentRoute } from '../router.js';
import { openDayDetail } from './dayDetail.js';
import { getUniversities, getExamSchedule, activeRound } from '../universities.js';

export const SIDEBAR_BLOCKS = [
  { key: 'calendar', label: '📅 Lịch', on: true },
  { key: 'progress', label: '📊 Tiến độ tuần', on: false },
  { key: 'time', label: '⏱ Thời gian học', on: false },
  { key: 'goal', label: '🎯 Mục tiêu', on: true },
  { key: 'mascot', label: '🐱 Mèo Mochi', on: false },
];

export function sidebarOn(settings, key) {
  const block = SIDEBAR_BLOCKS.find((b) => b.key === key);
  const saved = settings && settings.sidebar ? settings.sidebar[key] : undefined;
  return saved === undefined ? !!(block && block.on) : !!saved;
}

export const NAV = [
  { path: '/', icon: '🏠', label: 'Tổng quan', short: 'Hôm nay' },
  { path: '/week', icon: '📅', label: 'Kế hoạch tuần', short: 'Tuần' },
  { path: '/subjects', icon: '📚', label: 'Môn học' },
  { path: '/pomodoro', icon: '🍅', label: 'Pomodoro', short: 'Tập trung' },
  { path: '/room', icon: '🏡', label: 'Góc học', short: 'Góc học' },
  { path: '/stats', icon: '📊', label: 'Nhìn lại một chút', short: 'Nhìn lại' },
  { path: '/goals', icon: '🎯', label: 'Mục tiêu' },
  { path: '/settings', icon: '⚙', label: 'Cài đặt' },
];

let calMonth = null; // { year, month }

export function renderSidebar() {
  const s = getState();
  const el = document.getElementById('sidebar');
  const viewMonday = fromKey(s.ui.viewWeek);
  if (!calMonth) calMonth = { year: viewMonday.getFullYear(), month: viewMonday.getMonth() };
  const week = weekSummary(viewMonday);
  const route = currentRoute();
  const path = route ? route.path : '/';
  const maxMin = Math.max(30, ...week.perDay.map((d) => d.minutes));

  // Mục tiêu
  const g = s.goal;
  const show = (key) => sidebarOn(s.settings, key);

  el.innerHTML = `
    <div class="sidebar-inner">
      ${show('calendar') ? `<section class="side-block" id="side-calendar">
        ${calendarHTML({ year: calMonth.year, month: calMonth.month, viewWeekKey: s.ui.viewWeek, showStatus: true })}
      </section>` : ''}

      ${show('progress') ? `<section class="side-block" id="side-progress">
        <h4 class="side-title">📊 TIẾN ĐỘ TUẦN</h4>
        <div class="mini-progress">
          ${week.perDay.map((d, i) => `
            <div class="mini-row ${d.key === todayKey() ? 'today' : ''}" data-day="${d.key}">
              <span class="mini-label">${DAY_SHORT[i]}</span>
              ${progressBar(d.percent, { height: 8, color: d.percent === 100 ? 'var(--matcha-dark)' : 'var(--peach-dark)' })}
              <span class="mini-val">${d.total ? d.percent + '%' : '–'}</span>
            </div>`).join('')}
        </div>
        <div class="side-foot">${week.done}/${week.total} nhiệm vụ · ${week.percent}%</div>
      </section>` : ''}

      ${show('time') ? `<section class="side-block" id="side-time">
        <h4 class="side-title">⏱ THỜI GIAN HỌC</h4>
        <div class="side-big">Tuần này<br><strong>${minutesToText(week.minutes)}</strong></div>
        <div class="mini-bars">
          ${week.perDay.map((d, i) => `<div class="mini-bar-col" title="${DAY_SHORT[i]}: ${minutesToText(d.minutes)}"><div class="mini-bar" style="height:${Math.max(4, (d.minutes / maxMin) * 100)}%"></div><span>${DAY_SHORT[i]}</span></div>`).join('')}
        </div>
      </section>` : ''}

      ${show('goal') ? `<button class="side-block side-goal" id="side-goal" type="button">
        <h4 class="side-title">🎯 MỤC TIÊU</h4>
        <div class="goal-mark">${goalBadge(g)}</div>
        <div class="goal-name">${escapeHtml(g.name || 'Chưa đặt mục tiêu')}</div>
        ${goalCountdowns(g)}
      </button>` : ''}

      ${show('mascot') ? `<section class="side-block side-mascot" id="side-mascot">
        <div class="mascot-wrap mascot-${mascot.state}" id="sidebar-mascot">${mascotSVG(64)}</div>
        <p class="mascot-bubble" id="sidebar-mascot-msg">${mascotMessage(mascot.state, { userName: s.settings.userName, stable: true })}</p>
      </section>` : ''}

      <nav class="side-nav" aria-label="Điều hướng">
        ${NAV.map((n) => `<a href="#${n.path}" class="nav-item ${path === n.path ? 'active' : ''}" data-path="${n.path}"><span class="nav-icon">${n.icon}</span>${n.label}</a>`).join('')}
      </nav>
    </div>`;

  const cal = el.querySelector('#side-calendar');
  if (cal) bindCalendar(cal, {
    onPick: (key) => {
      const monday = toKey(startOfWeek(key));
      update((st) => { st.ui.viewWeek = monday; st.ui.viewDay = key; }, { type: 'view' });
      if (path !== '/' && path !== '/week') navigate('/week');
      else openDayDetail(key);
    },
    onNav: (delta) => {
      const d = new Date(calMonth.year, calMonth.month + delta, 1);
      calMonth = { year: d.getFullYear(), month: d.getMonth() };
      renderSidebar();
    },
  });
  const goalBtn = el.querySelector('#side-goal');
  if (goalBtn) goalBtn.onclick = () => navigate('/goals');
  el.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', () => document.body.classList.remove('drawer-open')));
  const cat = el.querySelector('#sidebar-mascot');
  if (cat) cat.onclick = () => mascot.poke();
}

/** Đồng bộ tháng lịch theo tuần đang xem */
export function syncCalendarToWeek() {
  const s = getState();
  const d = fromKey(s.ui.viewWeek);
  const mid = new Date(d); mid.setDate(mid.getDate() + 3);
  calMonth = { year: mid.getFullYear(), month: mid.getMonth() };
}

function goalCountdowns(g) {
  const ids = g.examShows || [];
  const today = todayKey();
  const list = getExamSchedule().filter((e) => ids.includes(e.id));
  if (!list.length) return '<p class="goal-days">Chưa chọn kỳ thi</p>';
  return `<ul class="side-counts">${list.map((e) => {
    const round = activeRound(e, today);
    const n = round.date && !round.past ? daysBetween(today, round.date) : null;
    const text = !round.date ? 'Chưa chốt' : round.past ? 'Đã thi' : n === 0 ? 'Hôm nay' : `${n} ngày`;
    const label = e.single || !round.date ? escapeHtml(e.single ? e.name : (e.short || e.name)) : `${escapeHtml(e.short || e.name)} · Đợt ${round.index + 1}`;
    return `<li><span>${label}</span><strong>${text}</strong></li>`;
  }).join('')}</ul>`;
}

function goalBadge(g) {
  const uni = g.schoolId && getUniversities().find((u) => u.id === g.schoolId);
  const url = uni && typeof uni.url === 'string' && (uni.url.startsWith('https://') || uni.url.startsWith('data:image/')) ? uni.url.replace(/"/g, '') : '';
  if (url) return `<img class="goal-logo-side" alt="" src="${url}">`;
  return `<span class="goal-emoji">${g.icon || '🏛️'}</span>`;
}

export function goalProgressPercent() {
  const s = getState();
  const tasks = s.tasks;
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export function setSidebarMascotState(state) {
  const el = document.getElementById('sidebar-mascot');
  const msg = document.getElementById('sidebar-mascot-msg');
  if (el) el.className = `mascot-wrap mascot-${state}`;
  if (msg) msg.textContent = mascotMessage(state, { userName: getState().settings.userName });
}

export function renderBottomNav() {
  const el = document.getElementById('bottom-nav');
  const route = currentRoute();
  const path = route ? route.path : '/';
  const items = NAV.filter((n) => ['/', '/week', '/pomodoro', '/room', '/stats'].includes(n.path));
  el.innerHTML = items.map((n) => `<a href="#${n.path}" class="bnav-item ${path === n.path ? 'active' : ''}" aria-label="${n.label}"><span>${n.icon}</span><small>${n.short || n.label}</small></a>`).join('');
}
