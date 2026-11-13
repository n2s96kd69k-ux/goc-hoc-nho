// ===== Trang /subjects =====
import { getState } from '../state.js';
import { escapeHtml, minutesToText } from '../utils.js';
import { subjectStats, addSubject, updateSubject, deleteSubject, addScore, SUBJECT_COLORS, SUBJECT_ICONS, getSubject } from '../subjects.js';
import { progressBar } from '../components/progressRing.js';
import { openModal, confirmDialog } from '../components/modal.js';
import { openTaskForm } from '../components/taskForm.js';
import { toast } from '../components/toast.js';
import { navigate } from '../router.js';

export function renderSubjects(root, params = {}) {
  if (params.id) return renderSubjectDetail(root, params.id);
  const s = getState();
  root.innerHTML = `
    <section class="page">
      <div class="page-head">
        <div><h1 class="page-title">📚 MÔN HỌC</h1><p class="page-sub">Mỗi môn một góc nhỏ, chăm từng chút một.</p></div>
        <button class="btn btn-primary" type="button" id="add-subject">+ Thêm môn</button>
      </div>
      <div class="subject-grid">
        ${s.subjects.map((sub) => {
          const st = subjectStats(sub.id);
          return `
          <a class="subject-card paper" href="#/subjects?id=${sub.id}" style="--sub:${sub.color}">
            <div class="tape"></div>
            <div class="subject-head"><span class="subject-icon">${sub.icon}</span><h3>${escapeHtml(sub.name).toUpperCase()}</h3></div>
            ${progressBar(st.percent, { color: 'var(--brown)', height: 10 })}
            <div class="subject-pct">${st.percent}%</div>
            <dl class="subject-stats">
              <div><dt>Thời gian</dt><dd>${minutesToText(st.minutes)}</dd></div>
              <div><dt>Nhiệm vụ</dt><dd>${st.done} / ${st.total}</dd></div>
              <div><dt>Pomodoro</dt><dd>${st.pomodoros}</dd></div>
            </dl>
          </a>`;
        }).join('')}
        ${s.subjects.length === 0 ? '<p class="muted">Chưa có môn nào. Thêm môn đầu tiên nhé 🌷</p>' : ''}
      </div>
    </section>`;
  root.querySelector('#add-subject').onclick = () => openSubjectForm();
}

function renderSubjectDetail(root, id) {
  const sub = getSubject(id);
  if (!sub) { navigate('/subjects'); return; }
  const s = getState();
  const st = subjectStats(id);
  const tasks = s.tasks.filter((t) => t.subjectId === id).sort((a, b) => a.date.localeCompare(b.date));
  const scores = sub.scores || [];
  root.innerHTML = `
    <section class="page" style="--sub:${sub.color}">
      <a class="back-link" href="#/subjects">‹ Tất cả môn học</a>
      <div class="page-head">
        <div><h1 class="page-title">${sub.icon} ${escapeHtml(sub.name).toUpperCase()}</h1><p class="page-sub">${st.done}/${st.total} nhiệm vụ · ${minutesToText(st.minutes)} · ${st.pomodoros} Pomodoro</p></div>
        <div class="btn-row">
          <button class="btn btn-ghost" type="button" id="edit-subject">✏️ Sửa</button>
          <button class="btn btn-primary" type="button" id="add-task">+ Nhiệm vụ</button>
        </div>
      </div>

      <div class="detail-grid">
        <div class="paper">
          <h4 class="side-title">Tiến độ</h4>
          ${progressBar(st.percent, { color: 'var(--brown)', height: 12 })}
          <div class="subject-pct">${st.percent}%</div>
        </div>

        <div class="paper">
          <h4 class="side-title">📖 Chương / bài học</h4>
          <ul class="chapter-list" id="chapter-list">
            ${(sub.chapters || []).map((c, i) => `<li><span>${escapeHtml(c)}</span><button type="button" class="icon-btn" data-del-ch="${i}" aria-label="Xóa">✕</button></li>`).join('')}
          </ul>
          <form class="inline-form" id="chapter-form"><input placeholder="Thêm chương…" maxlength="60" required><button class="btn btn-soft btn-sm" type="submit">Thêm</button></form>
        </div>

        <div class="paper">
          <h4 class="side-title">📝 Điểm kiểm tra</h4>
          ${scores.length ? `<ul class="score-list">${scores.map((sc) => `<li><strong>${sc.score}</strong><span>${escapeHtml(sc.note || '')}</span><small>${sc.date || ''}</small></li>`).join('')}</ul>` : '<p class="muted small">Chưa có điểm nào.</p>'}
          <form class="inline-form" id="score-form"><input type="number" step="0.25" min="0" max="10" name="score" placeholder="Điểm" required><input name="note" placeholder="Ghi chú" maxlength="40"><button class="btn btn-soft btn-sm" type="submit">Lưu</button></form>
        </div>

        <div class="paper span-2">
          <h4 class="side-title">✅ Nhiệm vụ của môn</h4>
          ${tasks.length ? `<ul class="task-list compact">${tasks.map((t) => `<li class="task ${t.done ? 'done' : ''}"><span class="checkbox ${t.done ? 'checked' : ''} static"><span class="check-mark">✓</span></span><button type="button" class="task-title" data-edit="${t.id}">${escapeHtml(t.title)}<span class="task-meta">${t.date.slice(8)}/${t.date.slice(5, 7)} · ${t.minutes}p</span></button></li>`).join('')}</ul>` : '<p class="muted small">Chưa có nhiệm vụ cho môn này.</p>'}
        </div>
      </div>
    </section>`;

  root.querySelector('#add-task').onclick = () => openTaskForm({ date: new Date().toISOString().slice(0, 10) });
  root.querySelector('#edit-subject').onclick = () => openSubjectForm(id);
  root.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openTaskForm({ taskId: b.dataset.edit }));
  root.querySelector('#chapter-form').onsubmit = (e) => {
    e.preventDefault();
    const inp = e.target.querySelector('input');
    updateSubject(id, { chapters: [...(sub.chapters || []), inp.value.trim()] });
  };
  root.querySelectorAll('[data-del-ch]').forEach((b) => b.onclick = () => {
    const ch = [...sub.chapters]; ch.splice(Number(b.dataset.delCh), 1);
    updateSubject(id, { chapters: ch });
  });
  root.querySelector('#score-form').onsubmit = (e) => {
    e.preventDefault();
    addScore(id, e.target.score.value, e.target.note.value);
    toast('Đã lưu điểm ✨');
  };
}

export function openSubjectForm(id = null) {
  const sub = id ? getSubject(id) : null;
  const v = sub || { name: '', color: SUBJECT_COLORS[getState().subjects.length % SUBJECT_COLORS.length], icon: '📘' };
  const m = openModal({
    title: sub ? '✏️ Sửa môn học' : '📚 Thêm môn học', size: 'sm',
    content: `
      <form class="task-form" id="subject-form">
        <label class="field"><span>Tên môn</span><input name="name" required maxlength="40" value="${escapeHtml(v.name)}" placeholder="Ví dụ: Lịch sử"></label>
        <fieldset class="field"><legend>Biểu tượng</legend><div class="chip-group icons">
          ${SUBJECT_ICONS.map((ic) => `<label class="chip-radio"><input type="radio" name="icon" value="${ic}" ${v.icon === ic ? 'checked' : ''}><span>${ic}</span></label>`).join('')}
        </div></fieldset>
        <fieldset class="field"><legend>Màu</legend><div class="chip-group colors">
          ${SUBJECT_COLORS.map((c) => `<label class="color-radio"><input type="radio" name="color" value="${c}" ${v.color === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}
        </div></fieldset>
        <div class="modal-actions ${sub ? 'spread' : ''}">
          ${sub ? '<button type="button" class="btn btn-ghost btn-danger-text" data-act="delete">🗑 Xóa môn</button>' : ''}
          <div class="right-actions"><button type="button" class="btn btn-ghost" data-act="cancel">Hủy</button><button class="btn btn-primary" type="submit">${sub ? 'Lưu' : 'Thêm môn'}</button></div>
        </div>
      </form>`,
  });
  const f = m.body.querySelector('#subject-form');
  f.onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f).entries());
    if (sub) { updateSubject(id, data); toast('Đã lưu môn học ✨'); }
    else { addSubject(data); toast('Đã thêm môn mới 🌷'); }
    m.close();
  };
  m.body.querySelector('[data-act="cancel"]').onclick = () => m.close();
  if (sub) m.body.querySelector('[data-act="delete"]').onclick = async () => {
    const ok = await confirmDialog({ title: 'Xóa môn học?', message: 'Các nhiệm vụ của môn sẽ được chuyển sang môn khác.', okText: 'Xóa', danger: true });
    if (ok) { deleteSubject(id); m.close(); navigate('/subjects'); }
  };
}
