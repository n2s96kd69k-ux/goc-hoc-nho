// ===== Lịch tháng nhỏ =====
import { DAY_SHORT, toKey, todayKey, startOfWeek, weekKeys, pad, fromKey } from '../utils.js';
import { dayStatus } from '../statistics.js';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

/**
 * @param {object} o
 * @param {number} o.year  @param {number} o.month (0-11)
 * @param {string} o.viewWeekKey  monday key của tuần đang xem
 * @param {boolean} o.showStatus  hiển thị chấm trạng thái
 */
export function calendarHTML({ year, month, viewWeekKey, showStatus = false, compact = true }) {
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const t = todayKey();
  const weekSet = new Set(viewWeekKey ? weekKeys(fromKey(viewWeekKey)) : []);
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`;
    const cls = ['cal-cell'];
    if (key === t) cls.push('today');
    if (weekSet.has(key)) cls.push('in-week');
    const st = showStatus ? dayStatus(key) : null;
    if (st) cls.push('st-' + st);
    cells += `<button type="button" class="${cls.join(' ')}" data-date="${key}" aria-label="${d}/${month + 1}">${d}${st && st !== 'future' && st !== 'none' ? `<i class="cal-dot"></i>` : ''}</button>`;
  }
  return `
    <div class="calendar ${compact ? 'compact' : ''}">
      <div class="cal-head">
        <button type="button" class="icon-btn cal-nav" data-nav="-1" aria-label="Tháng trước">‹</button>
        <span class="cal-title">📅 ${MONTHS[month].toUpperCase()} ${year !== new Date().getFullYear() ? year : ''}</span>
        <button type="button" class="icon-btn cal-nav" data-nav="1" aria-label="Tháng sau">›</button>
      </div>
      <div class="cal-grid cal-dow">${DAY_SHORT.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
    </div>`;
}

/** Gắn sự kiện: onPick(dateKey), onNav(delta) */
export function bindCalendar(root, { onPick, onNav }) {
  root.querySelectorAll('.cal-cell[data-date]').forEach((b) => b.onclick = () => onPick(b.dataset.date));
  root.querySelectorAll('.cal-nav').forEach((b) => b.onclick = () => onNav(Number(b.dataset.nav)));
}
