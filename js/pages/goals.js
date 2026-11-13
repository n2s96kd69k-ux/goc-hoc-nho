// ===== Trang /goals : Mục tiêu =====
import { getState, update } from '../state.js';
import { escapeHtml, todayKey, daysBetween, formatDMY, fromKey } from '../utils.js';
import { goalProgressPercent } from '../components/sidebar.js';
import { progressBar } from '../components/progressRing.js';
import { toast } from '../components/toast.js';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const ICONS = ['🏛️', '🎓', '📜', '🏫', '🌟', '🚀', '🏆', '🌷'];

export function renderGoals(root) {
  const g = getState().goal;
  const t = todayKey();
  const daysLeft = g.examDate ? daysBetween(t, g.examDate) : null;
  const percent = goalProgressPercent();

  // Timeline theo tháng từ hôm nay đến ngày thi
  let timeline = '';
  if (g.examDate && daysLeft >= 0) {
    const now = new Date(); now.setDate(1);
    const end = fromKey(g.examDate);
    const months = [];
    const cur = new Date(now);
    while (cur <= end && months.length < 24) { months.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
    const total = months.length;
    timeline = `<ol class="timeline">
      ${months.map((m, i) => `<li class="${i === 0 ? 'current' : ''}" style="--i:${i / Math.max(1, total)}"><span>${MONTHS[m.getMonth()].toUpperCase()}${m.getFullYear() !== now.getFullYear() ? ' ' + m.getFullYear() : ''}</span></li>`).join('')}
      <li class="exam"><span>🎯 NGÀY THI · ${formatDMY(g.examDate)}</span></li>
    </ol>`;
  }

  root.innerHTML = `
    <section class="page">
      <h1 class="page-title">🎯 MỤC TIÊU</h1>
      <p class="page-sub">Đích đến của những ngày cố gắng.</p>

      <div class="goal-layout">
        <div class="paper goal-hero tone-lavender">
          <div class="tape"></div>
          <div class="goal-icon-big">${g.icon || '🏛️'}</div>
          <h2>${escapeHtml(g.name || 'Chưa đặt mục tiêu')}</h2>
          <div class="goal-meta">
            <div><small>Ngày thi</small><strong>${g.examDate ? formatDMY(g.examDate) : '__/__/____'}</strong></div>
            <div><small>Điểm mục tiêu</small><strong>${g.targetScore || '____'}</strong></div>
            <div><small>Còn</small><strong>${daysLeft === null ? '—' : daysLeft >= 0 ? `${daysLeft} ngày` : 'Đã thi'}</strong></div>
          </div>
          ${progressBar(percent, { color: 'var(--lavender-dark)', height: 12 })}
          <div class="goal-pct">Tiến độ nhiệm vụ: ${percent}%</div>
          ${g.note ? `<p class="goal-note">“${escapeHtml(g.note)}”</p>` : ''}
        </div>

        <form class="paper task-form" id="goal-form">
          <h4 class="side-title">✏️ Chỉnh mục tiêu</h4>
          <label class="field"><span>Tên mục tiêu</span><input name="name" maxlength="60" value="${escapeHtml(g.name)}" placeholder="Ví dụ: Học viện Cán bộ"></label>
          <fieldset class="field"><legend>Biểu tượng</legend><div class="chip-group icons">${ICONS.map((ic) => `<label class="chip-radio"><input type="radio" name="icon" value="${ic}" ${g.icon === ic ? 'checked' : ''}><span>${ic}</span></label>`).join('')}</div></fieldset>
          <div class="field-row">
            <label class="field"><span>Ngày thi</span><input type="date" name="examDate" value="${g.examDate || ''}"></label>
            <label class="field"><span>Điểm mục tiêu</span><input name="targetScore" maxlength="10" value="${escapeHtml(g.targetScore)}" placeholder="27.5"></label>
          </div>
          <label class="field"><span>Lời nhắn cho mình</span><textarea name="note" rows="2" maxlength="160" placeholder="Một câu để nhớ vì sao mình bắt đầu…">${escapeHtml(g.note || '')}</textarea></label>
          <div class="modal-actions"><button class="btn btn-primary" type="submit">Lưu mục tiêu</button></div>
        </form>
      </div>

      ${timeline ? `<div class="paper timeline-box"><h4 class="side-title">🗓 Hành trình đến ngày thi</h4>${timeline}</div>` : '<p class="muted">Đặt ngày thi để thấy hành trình theo tháng nhé 🌷</p>'}
    </section>`;

  root.querySelector('#goal-form').onsubmit = (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    update((s) => { Object.assign(s.goal, data); }, { type: 'goal' });
    toast('Đã lưu mục tiêu 🎯');
  };
}
