// ===== WEEKLY PLANNER — nhân vật chính =====
import { getState, update } from '../state.js';
import { DAY_LABELS, DAY_SHORT, DAY_ICONS, DAY_COLORS, fromKey, toKey, addDays, weekKeys, weekRangeLabel, formatDM, todayKey, startOfWeek, minutesToText, escapeHtml, PRIORITIES } from '../utils.js';
import { tasksOfDay, dayProgress, mainSubjectOfDay, toggleTask, applyFilter, getTask } from '../tasks.js';
import { getSubject } from '../subjects.js';
import { minutesOfDay, pomodorosOfDay, dayStatus } from '../statistics.js';
import { progressRing } from './progressRing.js';
import { openTaskForm } from './taskForm.js';
import { floatCoins, sparkleAt, streakPopup } from './reward.js';
import { toast } from './toast.js';
import { mascotSVG } from '../mascot.js';
import { syncCalendarToWeek } from './sidebar.js';

const MAX_VISIBLE = 6;
const expanded = new Set();

export function plannerHTML() {
  const s = getState();
  const monday = fromKey(s.ui.viewWeek);
  const keys = weekKeys(monday);
  const t = todayKey();
  const isThisWeek = keys.includes(t);
  const filter = s.ui.filter || 'all';
  const viewDay = keys.includes(s.ui.viewDay) ? s.ui.viewDay : (isThisWeek ? t : keys[0]);
  const filters = [
    { id: 'all', label: 'Tất cả' },
    ...s.subjects.map((sub) => ({ id: sub.id, label: `${sub.icon} ${sub.name}` })),
    { id: 'done', label: '✓ Hoàn thành' },
    { id: 'todo', label: '○ Chưa xong' },
  ];
  return `
    <section class="planner" id="planner">
      <div class="planner-head">
        <h1 class="page-title">🌷 KẾ HOẠCH ÔN THI ${isThisWeek ? 'TUẦN NÀY' : 'TUẦN'}</h1>
        <div class="week-nav">
          <button class="btn btn-ghost btn-sm" type="button" data-week="-1">‹ Tuần trước</button>
          <button class="week-range" type="button" data-week="0" title="Về tuần này">${weekRangeLabel(monday)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-week="1">Tuần sau ›</button>
        </div>
        <button class="btn btn-primary" type="button" id="add-task-btn">+ THÊM NHIỆM VỤ</button>
      </div>
      <div class="filter-row" role="tablist" aria-label="Bộ lọc">
        ${filters.map((f) => `<button type="button" class="chip ${filter === f.id ? 'active' : ''}" data-filter="${f.id}">${f.label}</button>`).join('')}
      </div>
      <div class="day-tabs" aria-label="Chọn ngày">
        ${keys.map((k, i) => {
          const p = dayProgress(k);
          return `<button type="button" class="day-tab ${k === viewDay ? 'active' : ''} ${k === t ? 'today' : ''}" data-day="${k}">
            <span>${DAY_SHORT[i]}</span><small>${fromKey(k).getDate()}</small>${p.total && p.done === p.total ? '<i class="tab-done">✓</i>' : ''}
          </button>`;
        }).join('')}
      </div>
      <div class="week-grid" id="week-grid" data-view-day="${viewDay}">
        ${keys.map((k, i) => dayCardHTML(k, i, filter, k === viewDay)).join('')}
      </div>
    </section>`;
}

function dayCardHTML(key, i, filter, isActive) {
  const t = todayKey();
  const all = tasksOfDay(key);
  const list = applyFilter(all, filter);
  const prog = dayProgress(key);
  const main = mainSubjectOfDay(key);
  const isToday = key === t;
  const isPast = key < t;
  const complete = prog.total > 0 && prog.done === prog.total;
  const isExpanded = expanded.has(key);
  const visible = isExpanded ? list : list.slice(0, MAX_VISIBLE);
  const hidden = list.length - visible.length;
  const minutes = minutesOfDay(key);
  const pomos = pomodorosOfDay(key);
  const cls = ['day-card', `tone-${DAY_COLORS[i]}`];
  if (isToday) cls.push('is-today');
  if (isPast && !complete) cls.push('is-past');
  if (complete) cls.push('is-complete');
  if (isActive) cls.push('is-active');
  return `
    <article class="${cls.join(' ')}" data-day="${key}">
      <div class="tape"></div>
      ${complete ? '<span class="sticker-done">✨ HOÀN THÀNH</span>' : isToday ? '<span class="sticker-today">☀️ Hôm nay</span>' : ''}
      <header class="day-head">
        <span class="day-icon">${DAY_ICONS[i]}</span>
        <div>
          <div class="day-name">${DAY_LABELS[i].toUpperCase()}</div>
          <div class="day-date">${formatDM(key)}</div>
        </div>
      </header>
      <div class="day-progress">
        ${progressRing(prog.percent, { size: 78, stroke: 8, color: complete ? 'var(--matcha-dark)' : `var(--${DAY_COLORS[i]}-dark)` })}
        <div class="day-progress-text"><strong>${prog.done} / ${prog.total}</strong><span>nhiệm vụ</span></div>
      </div>
      ${main ? `<div class="day-subject" style="--sub:${main.color}">🎯 ${escapeHtml(main.name).toUpperCase()}</div>` : ''}
      <div class="day-tasks">
        ${all.length === 0 ? emptyDayHTML(key) : list.length === 0 ? '<p class="muted small">Không có nhiệm vụ khớp bộ lọc.</p>' : `
          <ul class="task-list">
            ${visible.map((tk) => taskItemHTML(tk)).join('')}
          </ul>
          ${hidden > 0 ? `<button type="button" class="link-btn" data-more="${key}">Xem thêm ${hidden} việc…</button>` : ''}
          ${isExpanded && list.length > MAX_VISIBLE ? `<button type="button" class="link-btn" data-less="${key}">Thu gọn</button>` : ''}
        `}
      </div>
      <footer class="day-foot">
        <span title="Pomodoro">🍅 ${pomos} Pomodoro</span>
        <span title="Thời gian học">☕ ${minutesToText(minutes)}</span>
        <button type="button" class="icon-btn add-mini" data-add="${key}" aria-label="Thêm nhiệm vụ cho ngày này">+</button>
      </footer>
    </article>`;
}

function taskItemHTML(t) {
  const sub = getSubject(t.subjectId);
  return `
    <li class="task ${t.done ? 'done' : ''} pr-${t.priority}" data-id="${t.id}">
      <button class="checkbox ${t.done ? 'checked' : ''}" type="button" data-toggle="${t.id}" aria-label="${t.done ? 'Bỏ đánh dấu' : 'Hoàn thành'}: ${escapeHtml(t.title)}" aria-pressed="${t.done}">
        <span class="check-mark">✓</span>
      </button>
      <button class="task-title" type="button" data-edit="${t.id}" title="${escapeHtml(t.note || t.title)}">
        ${escapeHtml(t.title)}
        <span class="task-meta">${sub ? `<i class="subject-dot" style="background:${sub.color}"></i>${escapeHtml(sub.name)}` : ''}${t.minutes ? ` · ${t.minutes}p` : ''}${t.priority === 'high' ? ' 🌷' : ''}</span>
      </button>
    </li>`;
}

function emptyDayHTML(key) {
  return `
    <div class="empty-day">
      <div class="empty-mascot">${mascotSVG(56, { state: 'sleepy' })}</div>
      <p>Chưa có kế hoạch ${key === todayKey() ? 'hôm nay' : 'ngày này'}.</p>
      <small>Nào, thêm một nhiệm vụ đầu tiên nhé?</small>
      <button type="button" class="btn btn-soft btn-sm" data-add="${key}">+ Thêm nhiệm vụ</button>
    </div>`;
}

export function bindPlanner(root) {
  const s = getState();
  root.querySelectorAll('[data-week]').forEach((b) => b.onclick = () => {
    const delta = Number(b.dataset.week);
    update((st) => {
      const monday = delta === 0 ? startOfWeek(todayKey()) : addDays(fromKey(st.ui.viewWeek), delta * 7);
      st.ui.viewWeek = toKey(monday);
      const keys = weekKeys(monday);
      st.ui.viewDay = keys.includes(todayKey()) ? todayKey() : keys[0];
      syncCalendarToWeek();
    }, { type: 'view' });
  });
  root.querySelector('#add-task-btn').onclick = () => openTaskForm({ date: s.ui.viewDay || todayKey() });
  root.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => openTaskForm({ date: b.dataset.add }));
  root.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openTaskForm({ taskId: b.dataset.edit }));
  root.querySelectorAll('[data-filter]').forEach((b) => b.onclick = () => update((st) => { st.ui.filter = b.dataset.filter; }, { type: 'view' }));
  root.querySelectorAll('[data-more]').forEach((b) => b.onclick = () => { expanded.add(b.dataset.more); update(() => {}, { type: 'view' }); });
  root.querySelectorAll('[data-less]').forEach((b) => b.onclick = () => { expanded.delete(b.dataset.less); update(() => {}, { type: 'view' }); });
  root.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = (e) => {
    e.stopPropagation();
    b.classList.add('animating');
    const res = toggleTask(b.dataset.toggle);
    if (res && res.done) {
      floatCoins(res.coins, b);
      if (res.dayComplete) {
        const card = b.closest('.day-card');
        sparkleAt(card ? card.querySelector('.ring') : b, 8);
        toast(`Hôm nay giỏi lắm 🌷 +${res.coins} xu`, { icon: '✨' });
      } else {
        toast('Xong một việc rồi ✨', { icon: '✓' });
      }
      res.streakEvents.forEach((ev) => setTimeout(() => streakPopup(ev.milestone, ev.coins), 500));
    }
  });
  root.querySelectorAll('[data-day].day-tab').forEach((b) => b.onclick = () => setViewDay(b.dataset.day));
  const grid = root.querySelector('#week-grid');
  let sx = 0, sy = 0, tracking = false;
  grid.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (!tracking) return; tracking = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const keys = weekKeys(fromKey(getState().ui.viewWeek));
      const idx = keys.indexOf(grid.dataset.viewDay);
      const next = idx + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < 7) setViewDay(keys[next], dx < 0 ? 'left' : 'right');
    }
  }, { passive: true });
}

function setViewDay(key, dir) {
  update((st) => { st.ui.viewDay = key; }, { type: 'view', slide: dir });
}

export function patchTaskToggle(id) {
  const task = getTask(id);
  if (!task) return;
  const done = !!task.done;
  document.querySelectorAll(`[data-toggle="${id}"]`).forEach((btn) => {
    btn.classList.toggle('checked', done);
    btn.setAttribute('aria-pressed', String(done));
    const li = btn.closest('.task');
    if (li) li.classList.toggle('done', done);
  });
  document.querySelectorAll(`.day-card[data-day="${task.date}"]`).forEach((card) => updateDayCardProgress(card, task.date));
  updateDayTab(task.date);
  updateTodayBar(task.date);
  updateSideProgress(task.date);
  updateCalDot(task.date);
}

function updateDayCardProgress(card, key) {
  const prog = dayProgress(key);
  const complete = prog.total > 0 && prog.done === prog.total;
  const strong = card.querySelector('.day-progress-text strong');
  if (strong) strong.textContent = `${prog.done} / ${prog.total}`;
  const label = card.querySelector('.ring-label');
  if (label) label.textContent = `${prog.percent}%`;
  const ring = card.querySelector('.ring-fill');
  if (ring) {
    const circ = parseFloat(ring.getAttribute('stroke-dasharray')) || 0;
    ring.setAttribute('stroke-dashoffset', (circ - (circ * prog.percent) / 100).toFixed(2));
    const tone = [...card.classList].find((cls) => cls.startsWith('tone-'));
    ring.setAttribute('stroke', complete ? 'var(--matcha-dark)' : `var(--${tone ? tone.slice(5) : 'matcha'}-dark)`);
  }
  card.classList.toggle('is-complete', complete);
  card.classList.toggle('is-past', key < todayKey() && !complete);
  const sticker = card.querySelector('.sticker-done');
  const todaySticker = card.querySelector('.sticker-today');
  if (complete) {
    if (todaySticker) todaySticker.remove();
    if (!sticker) {
      const s = document.createElement('span');
      s.className = 'sticker-done';
      s.textContent = '✨ HOÀN THÀNH';
      card.appendChild(s);
    }
  } else if (sticker) {
    sticker.remove();
    if (key === todayKey() && !card.querySelector('.sticker-today')) {
      const s = document.createElement('span');
      s.className = 'sticker-today';
      s.textContent = '☀️ Hôm nay';
      card.appendChild(s);
    }
  }
}

function updateDayTab(key) {
  const tab = document.querySelector(`.day-tab[data-day="${key}"]`);
  if (!tab) return;
  const prog = dayProgress(key);
  const complete = prog.total > 0 && prog.done === prog.total;
  const mark = tab.querySelector('.tab-done');
  if (complete && !mark) {
    const i = document.createElement('i');
    i.className = 'tab-done';
    i.textContent = '✓';
    tab.appendChild(i);
  } else if (!complete && mark) mark.remove();
}

function updateTodayBar(key) {
  if (key !== todayKey()) return;
  const prog = dayProgress(key);
  const el = document.querySelector('.today-prog');
  if (el) el.innerHTML = `${prog.done} / ${prog.total} nhiệm vụ · <strong>${prog.percent}%</strong>`;
  const goal = document.querySelector('.today-goal');
  if (!goal) return;
  const next = tasksOfDay(key).find((x) => !x.done);
  goal.textContent = next ? `Mục tiêu: ${next.title}` : (prog.total ? 'Hôm nay giỏi lắm 🌷 Đã xong hết!' : 'Chưa có kế hoạch hôm nay.');
}

function updateSideProgress(key) {
  const prog = dayProgress(key);
  const row = document.querySelector(`.mini-row[data-day="${key}"]`);
  if (row) {
    const fill = row.querySelector('.bar-fill');
    const val = row.querySelector('.mini-val');
    if (fill) {
      fill.style.width = `${prog.percent}%`;
      fill.style.background = prog.percent === 100 ? 'var(--matcha-dark)' : 'var(--peach-dark)';
    }
    if (val) val.textContent = prog.total ? `${prog.percent}%` : '–';
  }
  const keys = weekKeys(fromKey(getState().ui.viewWeek));
  if (!keys.includes(key)) return;
  let done = 0, total = 0;
  for (const k of keys) {
    const p = dayProgress(k);
    done += p.done;
    total += p.total;
  }
  const foot = document.querySelector('#side-progress .side-foot');
  if (foot) foot.textContent = `${done}/${total} nhiệm vụ · ${total ? Math.round((done / total) * 100) : 0}%`;
}

function updateCalDot(key) {
  const cell = document.querySelector(`.cal-cell[data-date="${key}"]`);
  if (!cell) return;
  const st = dayStatus(key);
  cell.classList.remove('st-good', 'st-partial', 'st-missed', 'st-none', 'st-future');
  if (st) cell.classList.add('st-' + st);
  let dot = cell.querySelector('.cal-dot');
  const show = st && st !== 'future' && st !== 'none';
  if (show && !dot) {
    dot = document.createElement('i');
    dot.className = 'cal-dot';
    cell.appendChild(dot);
  } else if (!show && dot) dot.remove();
}
