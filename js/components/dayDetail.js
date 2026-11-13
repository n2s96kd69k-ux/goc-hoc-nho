// ===== Popup chi tiết một ngày (từ lịch tháng) =====
import { getState, update, dayRecord } from '../state.js';
import { escapeHtml, dayLabelOf, formatDMY, MOODS, minutesToText } from '../utils.js';
import { tasksOfDay, toggleTask } from '../tasks.js';
import { minutesOfDay, pomodorosOfDay } from '../statistics.js';
import { getSubject } from '../subjects.js';
import { openModal } from './modal.js';
import { openTaskForm } from './taskForm.js';

export function openDayDetail(key) {
  const m = openModal({ title: `${dayLabelOf(key)}, ${formatDMY(key)}`, size: 'md', content: '' });
  const render = () => {
    const s = getState();
    const d = s.days[key] || { mood: null, note: '' };
    const tasks = tasksOfDay(key);
    m.body.innerHTML = `
      <div class="day-detail">
        <div class="day-detail-stats">
          <span>🍅 ${pomodorosOfDay(key)} Pomodoro</span>
          <span>⏱ ${minutesToText(minutesOfDay(key))}</span>
          <span>✅ ${tasks.filter((t) => t.done).length}/${tasks.length} nhiệm vụ</span>
        </div>
        <h4 class="sub-title">Nhiệm vụ</h4>
        ${tasks.length ? `<ul class="task-list compact">${tasks.map((t) => {
          const sub = getSubject(t.subjectId);
          return `<li class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
            <button class="checkbox ${t.done ? 'checked' : ''}" type="button" data-toggle="${t.id}" aria-label="Hoàn thành"><span class="check-mark">✓</span></button>
            <span class="task-title" data-edit="${t.id}">${escapeHtml(t.title)}</span>
            ${sub ? `<span class="subject-dot" style="background:${sub.color}"></span>` : ''}
          </li>`;
        }).join('')}</ul>` : '<p class="muted">Chưa có nhiệm vụ nào cho ngày này.</p>'}
        <button class="btn btn-soft btn-sm" type="button" data-act="add">+ Thêm nhiệm vụ</button>

        <h4 class="sub-title">Tâm trạng</h4>
        <div class="mood-row">
          ${MOODS.map((mo) => `<button type="button" class="mood-btn ${d.mood === mo.id ? 'active' : ''}" data-mood="${mo.id}" title="${mo.label}"><span>${mo.emoji}</span><small>${mo.label}</small></button>`).join('')}
        </div>

        <h4 class="sub-title">Ghi chú</h4>
        <textarea class="day-note" rows="2" placeholder="Hôm nay thế nào nhỉ…">${escapeHtml(d.note || '')}</textarea>
      </div>`;

    m.body.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = () => { toggleTask(b.dataset.toggle); render(); });
    m.body.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { m.close(); openTaskForm({ taskId: b.dataset.edit }); });
    m.body.querySelector('[data-act="add"]').onclick = () => { m.close(); openTaskForm({ date: key }); };
    m.body.querySelectorAll('[data-mood]').forEach((b) => b.onclick = () => {
      update((st) => { const r = dayRecord(key); r.mood = r.mood === b.dataset.mood ? null : b.dataset.mood; }, { type: 'mood' });
      render();
    });
    const note = m.body.querySelector('.day-note');
    note.addEventListener('input', () => {
      update((st) => { dayRecord(key).note = note.value; }, { type: 'note', silent: true });
    });
  };
  render();
}
