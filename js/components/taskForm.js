// ===== Form thêm / sửa nhiệm vụ =====
import { getState } from '../state.js';
import { escapeHtml, PRIORITIES, formatDMY, dayLabelOf, todayKey } from '../utils.js';
import { addTask, updateTask, deleteTask, toggleTask, getTask } from '../tasks.js';
import { openModal, confirmDialog } from './modal.js';
import { toast } from './toast.js';
import { navigate } from '../router.js';
import { attachTask } from '../timer.js';

function subjectOptions(selected) {
  return getState().subjects.map((s) => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.icon} ${escapeHtml(s.name)}</option>`).join('');
}

export function openTaskForm({ date = todayKey(), taskId = null } = {}) {
  const task = taskId ? getTask(taskId) : null;
  const isEdit = !!task;
  const v = task || { title: '', subjectId: getState().subjects[0] && getState().subjects[0].id, date, minutes: 30, priority: 'medium', pomodoros: 1, note: '' };

  const m = openModal({
    title: isEdit ? '✏️ Sửa nhiệm vụ' : '🌷 Thêm nhiệm vụ',
    size: 'md',
    content: `
      <form class="task-form" id="task-form" autocomplete="off">
        <label class="field">
          <span>Tên nhiệm vụ</span>
          <input name="title" required maxlength="80" placeholder="Ví dụ: Làm 20 câu Toán" value="${escapeHtml(v.title)}">
        </label>
        <div class="field-row">
          <label class="field">
            <span>Môn học</span>
            <select name="subjectId">${subjectOptions(v.subjectId)}</select>
          </label>
          <label class="field">
            <span>Ngày</span>
            <input type="date" name="date" required value="${v.date}">
          </label>
        </div>
        <div class="field-row">
          <label class="field">
            <span>Thời lượng dự kiến (phút)</span>
            <input type="number" name="minutes" min="5" max="600" step="5" value="${v.minutes}">
          </label>
          <label class="field">
            <span>Số Pomodoro</span>
            <input type="number" name="pomodoros" min="0" max="20" value="${v.pomodoros}">
          </label>
        </div>
        <fieldset class="field">
          <legend>Độ ưu tiên</legend>
          <div class="chip-group">
            ${PRIORITIES.map((p) => `<label class="chip-radio"><input type="radio" name="priority" value="${p.id}" ${v.priority === p.id ? 'checked' : ''}><span>${p.dot} ${p.label}</span></label>`).join('')}
          </div>
        </fieldset>
        <label class="field">
          <span>Ghi chú</span>
          <textarea name="note" rows="2" maxlength="300" placeholder="Một dòng nhắc nhỏ cho mình…">${escapeHtml(v.note)}</textarea>
        </label>
        <div class="modal-actions ${isEdit ? 'spread' : ''}">
          ${isEdit ? `
            <div class="left-actions">
              <button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">🗑 Xóa</button>
              <button type="button" class="btn btn-ghost" data-act="toggle">${task.done ? '↩ Chưa xong' : '✓ Đánh dấu xong'}</button>
              <button type="button" class="btn btn-ghost" data-act="focus">🍅 Tập trung</button>
            </div>` : ''}
          <div class="right-actions">
            <button type="button" class="btn btn-ghost" data-act="cancel">Hủy</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Lưu thay đổi' : 'Thêm nhiệm vụ'}</button>
          </div>
        </div>
      </form>`,
  });

  const form = m.body.querySelector('#task-form');
  setTimeout(() => form.title.focus(), 60);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (!data.title.trim()) return;
    if (isEdit) {
      updateTask(task.id, { ...data, minutes: Number(data.minutes), pomodoros: Number(data.pomodoros) });
      toast('Đã lưu thay đổi ✨', { icon: '✏️' });
    } else {
      addTask(data);
      toast(`Thêm vào ${dayLabelOf(data.date)}, ${formatDMY(data.date)}`, { icon: '🌷' });
    }
    m.close();
  });

  m.body.querySelector('[data-act="cancel"]').onclick = () => m.close();

  if (isEdit) {
    m.body.querySelector('[data-act="delete"]').onclick = async () => {
      const ok = await confirmDialog({ title: 'Xóa nhiệm vụ này?', message: `"${escapeHtml(task.title)}" sẽ được bỏ khỏi kế hoạch.`, okText: 'Xóa', danger: true });
      if (ok) { deleteTask(task.id); toast('Đã xóa nhiệm vụ', { icon: '🗑' }); m.close(); }
    };
    m.body.querySelector('[data-act="toggle"]').onclick = () => { toggleTask(task.id); m.close(); };
    m.body.querySelector('[data-act="focus"]').onclick = () => {
      attachTask(task.id, task.subjectId);
      m.close();
      navigate('/pomodoro');
    };
  }
  return m;
}
