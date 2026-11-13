// ===== Trang / : Tổng quan = thanh "Hôm nay" gọn + Weekly planner =====
import { getState, update, dayRecord } from '../state.js';
import { todayKey, dayLabelOf, formatDM, MOODS, escapeHtml } from '../utils.js';
import { dayProgress, tasksOfDay } from '../tasks.js';
import { plannerHTML, bindPlanner } from '../components/planner.js';
import { navigate } from '../router.js';
import { attachTask } from '../timer.js';

export function renderOverview(root) {
  const s = getState();
  const t = todayKey();
  const prog = dayProgress(t);
  const d = s.days[t] || {};
  const nextTask = tasksOfDay(t).find((x) => !x.done);
  const goalText = nextTask ? `Mục tiêu: ${escapeHtml(nextTask.title)}` : prog.total ? 'Hôm nay giỏi lắm 🌷 Đã xong hết!' : 'Chưa có kế hoạch hôm nay.';

  root.innerHTML = `
    <section class="today-bar" id="today-bar">
      <div class="today-main">
        <span class="today-label">☀️ HÔM NAY</span>
        <span class="today-date">${dayLabelOf(t)}, ${formatDM(t)}</span>
        <span class="today-prog">${prog.done} / ${prog.total} nhiệm vụ · <strong>${prog.percent}%</strong></span>
        <span class="today-goal">${goalText}</span>
      </div>
      <div class="today-side">
        <div class="mood-mini" aria-label="Tâm trạng hôm nay">
          ${MOODS.map((m) => `<button type="button" class="mood-mini-btn ${d.mood === m.id ? 'active' : ''}" data-mood="${m.id}" title="${m.label}">${m.emoji}</button>`).join('')}
        </div>
        <button class="btn btn-primary" type="button" id="start-focus">🍅 BẮT ĐẦU TẬP TRUNG</button>
      </div>
    </section>
    ${plannerHTML()}`;

  bindPlanner(root);
  root.querySelector('#start-focus').onclick = () => {
    if (nextTask) attachTask(nextTask.id, nextTask.subjectId);
    navigate('/pomodoro');
  };
  root.querySelectorAll('[data-mood]').forEach((b) => b.onclick = () => {
    update((st) => { const r = dayRecord(t); r.mood = r.mood === b.dataset.mood ? null : b.dataset.mood; }, { type: 'mood' });
  });
}
