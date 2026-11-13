// ===== Trang /stats : Nhìn lại một chút =====
import { getState } from '../state.js';
import { minutesToText, escapeHtml, fromKey, DAY_SHORT, MOODS } from '../utils.js';
import { overallStats, lastNDays, moodStats } from '../statistics.js';
import { progressBar } from '../components/progressRing.js';

export function renderStats(root) {
  const o = overallStats();
  const days = lastNDays(14);
  const maxMin = Math.max(30, ...days.map((d) => d.minutes));
  const maxTask = Math.max(1, ...days.map((d) => d.tasks));
  const maxPomo = Math.max(1, ...days.map((d) => d.pomodoros));
  const moods = moodStats();
  const moodTotal = Object.values(moods).reduce((a, b) => a + b, 0);

  const bars = (arr, key, max, color) => `
    <div class="chart-bars">
      ${arr.map((d) => `<div class="chart-col" title="${d.key.slice(8)}/${d.key.slice(5, 7)}: ${key === 'minutes' ? minutesToText(d[key]) : d[key]}">
        <div class="chart-bar" style="height:${Math.max(3, (d[key] / max) * 100)}%;background:${color}"></div>
        <span>${DAY_SHORT[(fromKey(d.key).getDay() + 6) % 7]}</span>
      </div>`).join('')}
    </div>`;

  root.innerHTML = `
    <section class="page">
      <h1 class="page-title">📊 NHÌN LẠI MỘT CHÚT</h1>
      <p class="page-sub">Những con số nhỏ ghi lại sự cố gắng của bạn.</p>

      <div class="stat-grid">
        <div class="stat-card paper tone-butter"><span class="stat-icon">⏱</span><strong>${minutesToText(o.totalMinutes)}</strong><span>tổng thời gian học</span></div>
        <div class="stat-card paper tone-peach"><span class="stat-icon">🍅</span><strong>${o.totalPomos}</strong><span>Pomodoro</span></div>
        <div class="stat-card paper tone-matcha"><span class="stat-icon">✅</span><strong>${o.doneTasks}<small>/${o.totalTasks}</small></strong><span>nhiệm vụ hoàn thành</span></div>
        <div class="stat-card paper tone-rose"><span class="stat-icon">🔥</span><strong>${o.streak}</strong><span>chuỗi cố gắng hiện tại</span></div>
        <div class="stat-card paper tone-lavender"><span class="stat-icon">🏅</span><strong>${o.longest}</strong><span>chuỗi dài nhất</span></div>
        <div class="stat-card paper tone-sky"><span class="stat-icon">${o.topSubject ? o.topSubject.icon : '📘'}</span><strong>${o.topSubject ? escapeHtml(o.topSubject.name) : '–'}</strong><span>môn học nhiều nhất</span></div>
      </div>

      <div class="chart-grid">
        <div class="paper"><h4 class="side-title">⏱ Thời gian học · 14 ngày</h4>${bars(days, 'minutes', maxMin, 'var(--butter-dark)')}</div>
        <div class="paper"><h4 class="side-title">✅ Nhiệm vụ xong · 14 ngày</h4>${bars(days, 'tasks', maxTask, 'var(--matcha-dark)')}</div>
        <div class="paper"><h4 class="side-title">🍅 Pomodoro · 14 ngày</h4>${bars(days, 'pomodoros', maxPomo, 'var(--peach-dark)')}</div>
        <div class="paper">
          <h4 class="side-title">📚 Tiến độ môn</h4>
          <div class="subject-bars">
            ${o.subjects.map((s) => `<div class="mini-row"><span class="mini-label wide">${s.icon} ${escapeHtml(s.name)}</span>${progressBar(s.stats.percent, { color: s.color, height: 10 })}<span class="mini-val">${s.stats.percent}%</span></div>`).join('') || '<p class="muted small">Chưa có môn học.</p>'}
          </div>
        </div>
        <div class="paper">
          <h4 class="side-title">💭 Tâm trạng</h4>
          ${moodTotal ? `<div class="mood-stats">${MOODS.map((m) => `<div class="mood-stat"><span class="mood-emoji">${m.emoji}</span><strong>${moods[m.id]}</strong><small>${m.label}</small></div>`).join('')}</div>` : '<p class="muted small">Chưa ghi tâm trạng ngày nào. Thử chọn ở thanh Hôm nay nhé 🙂</p>'}
        </div>
      </div>
    </section>`;
}
