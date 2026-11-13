// ===== Trang /goals : Mục tiêu =====
import { getState, update } from '../state.js';
import { escapeHtml, todayKey, daysBetween, formatDMY, fromKey } from '../utils.js';
import { goalProgressPercent } from '../components/sidebar.js';
import { progressBar } from '../components/progressRing.js';
import { toast } from '../components/toast.js';
import { getUniversities, refreshUniversities, addUniversity, removeUniversity, isAdminUser } from '../universities.js';

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
          <div class="goal-icon-big">${goalMark(g)}</div>
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
          <fieldset class="field">
            <legend>Các trường đại học</legend>
            <div class="uni-grid" id="uni-grid"><span class="small muted">Đang tải logo…</span></div>
            <div id="uni-admin" hidden>
              <div class="field-row">
                <input id="uni-name" maxlength="60" placeholder="Tên trường">
                <input id="uni-file" type="file" accept="image/*">
              </div>
              <button class="btn btn-soft btn-sm" id="uni-add" type="button">Tải logo lên</button>
              <div class="uni-progress" id="uni-progress" hidden>
                <div class="bar"><div class="bar-fill" id="uni-fill" style="width:0%"></div></div>
                <strong id="uni-pct">0%</strong>
              </div>
              <p class="small muted">Chỉ quản trị viên tải được. Logo mới hiện với mọi tài khoản.</p>
            </div>
          </fieldset>
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
    const picked = e.target.querySelector('input[name="schoolId"]:checked');
    update((s) => {
      Object.assign(s.goal, data);
      s.goal.schoolId = picked ? picked.value : '';
    }, { type: 'goal' });
    toast('Đã lưu mục tiêu 🎯');
    renderGoals(root);
  };

  root.querySelectorAll('input[name="icon"]').forEach((el) => el.onchange = () => {
    root.querySelectorAll('input[name="schoolId"]').forEach((s) => { s.checked = false; });
  });

  const adminBox = root.querySelector('#uni-admin');
  if (isAdminUser()) adminBox.hidden = false;
  const paintUnis = () => {
    const current = getState().goal.schoolId;
    const list = getUniversities();
    const grid = root.querySelector('#uni-grid');
    if (!grid) return;
    grid.innerHTML = list.length ? list.map((u) => `
      <label class="uni-card ${u.id === current ? 'active' : ''}">
        <input type="radio" name="schoolId" value="${escapeHtml(u.id)}" ${u.id === current ? 'checked' : ''}>
        <img src="${safeUrl(u.url)}" alt="">
        <small>${escapeHtml(u.name)}</small>
        ${isAdminUser() ? `<button type="button" class="link-btn" data-del-uni="${escapeHtml(u.id)}">Xóa</button>` : ''}
      </label>`).join('') : '<span class="small muted">Chưa có logo trường nào.</span>';
    grid.querySelectorAll('input[name="schoolId"]').forEach((el) => el.onchange = () => {
      grid.querySelectorAll('.uni-card').forEach((c) => c.classList.toggle('active', c.querySelector('input').checked));
    });
    grid.querySelectorAll('[data-del-uni]').forEach((b) => b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.disabled = true;
      try {
        await removeUniversity(b.dataset.delUni);
        paintUnis();
        toast('Đã xóa logo');
      } catch (err) {
        toast(err.message || 'Không xóa được', { kind: 'error' });
        b.disabled = false;
      }
    });
  };
  paintUnis();
  refreshUniversities().then(paintUnis).catch(() => paintUnis());
  root.querySelector('#uni-add').onclick = async () => {
    const name = root.querySelector('#uni-name').value;
    const file = root.querySelector('#uni-file').files[0];
    const btn = root.querySelector('#uni-add');
    const box = root.querySelector('#uni-progress');
    const fill = root.querySelector('#uni-fill');
    const label = root.querySelector('#uni-pct');
    const setPct = (n) => {
      box.hidden = false;
      fill.style.width = n + '%';
      label.textContent = n + '%';
    };
    if (!file) { toast('Chọn file logo', { kind: 'error' }); return; }
    btn.disabled = true;
    setPct(0);
    try {
      await addUniversity(name, file, setPct);
      root.querySelector('#uni-name').value = '';
      root.querySelector('#uni-file').value = '';
      paintUnis();
      toast('100% — tài khoản khác đã thấy logo.');
    } catch (err) {
      toast(err.message || 'Không tải được logo', { kind: 'error' });
    }
    btn.disabled = false;
  };
}

function goalMark(g) {
  const uni = g.schoolId && getUniversities().find((u) => u.id === g.schoolId);
  if (uni && safeUrl(uni.url)) return `<img class="goal-logo" src="${safeUrl(uni.url)}" alt="">`;
  return g.icon || '🏛️';
}

function safeUrl(url) {
  if (typeof url !== 'string') return '';
  if (url.startsWith('https://') || url.startsWith('data:image/')) return url.replace(/"/g, '');
  return '';
}
