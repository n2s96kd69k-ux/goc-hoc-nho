// ===== Trang /goals : Mục tiêu =====
import { getState, update } from '../state.js';
import { escapeHtml, todayKey, daysBetween, formatDMY, fromKey } from '../utils.js';
import { goalProgressPercent, renderSidebar } from '../components/sidebar.js';
import { progressBar } from '../components/progressRing.js';
import { toast } from '../components/toast.js';
import { getUniversities, refreshUniversities, addUniversity, removeUniversity, isAdminUser, getExamSchedule, onExamSchedule, saveExamSchedule } from '../universities.js';

const MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const ICONS = ['🏛️', '🎓', '📜', '🏫', '🌟', '🚀', '🏆', '🌷'];
let stopExams = null;

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
      <li class="exam"><span>🎯 LỊCH THI · ${formatDMY(g.examDate)}</span></li>
    </ol>`;
  }

  root.innerHTML = `
    <section class="page">
      <h1 class="page-title">🎯 MỤC TIÊU</h1>
      <p class="page-sub">Đích đến của những ngày cố gắng.</p>

      <div class="goal-layout">
        <div class="goal-main">
        <div class="paper goal-hero tone-lavender">
          <div class="tape"></div>
          <div class="goal-icon-big">${goalMark(g)}</div>
          <h2>${escapeHtml(g.name || 'Chưa đặt mục tiêu')}</h2>
          <div id="exam-shown"></div>
          <div class="goal-meta">
            <div><small>Điểm mục tiêu</small><strong>${g.targetScore || '____'}</strong></div>
            <div><small>Còn</small><strong id="goal-left">${daysLeft === null ? '—' : daysLeft >= 0 ? `${daysLeft} ngày` : 'Đã thi'}</strong></div>
          </div>
          ${progressBar(percent, { color: 'var(--lavender-dark)', height: 12 })}
          <div class="goal-pct">Tiến độ nhiệm vụ: ${percent}%</div>
          ${g.note ? `<p class="goal-note">“${escapeHtml(g.note)}”</p>` : ''}
        </div>
        <div class="paper exam-count" id="exam-count"></div>
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
          <fieldset class="field" id="exam-board">
            <legend>Lịch thi</legend>
          </fieldset>
          <label class="field"><span>Điểm mục tiêu</span><input name="targetScore" maxlength="10" value="${escapeHtml(g.targetScore)}" placeholder="27.5"></label>
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
  paintExams();
  if (stopExams) stopExams();
  stopExams = onExamSchedule(() => paintExams());
  refreshUniversities().then(() => { paintUnis(); paintExams(); }).catch(() => paintUnis());
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

function shownExams() {
  const ids = getState().goal.examShows || [];
  return getExamSchedule().filter((e) => ids.includes(e.id));
}

function nearestDate(list) {
  const today = todayKey();
  const dates = list.flatMap((e) => e.dates || []).filter(Boolean).sort();
  return dates.find((d) => d >= today) || '';
}

function dayText(date, today) {
  if (!date) return 'Chưa chốt';
  const n = daysBetween(today, date);
  if (n > 0) return `${n} ngày`;
  if (n === 0) return 'Hôm nay';
  return 'Đã thi';
}

function roundRow(id, date, index, admin, single) {
  const label = single ? '' : `<span class="round-label">Đợt ${index + 1}</span>`;
  const del = admin && !single ? '<button type="button" class="round-del" data-del-round aria-label="Xóa đợt">×</button>' : '';
  if (!admin) return `<div class="exam-round">${label}<span class="exam-date">${formatDMY(date)}</span></div>`;
  return `<div class="exam-round">${label}<input class="exam-date" type="date" data-exam="${id}" value="${escapeHtml(date || '')}">${del}</div>`;
}

function paintExams() {
  const board = document.querySelector('#exam-board');
  const count = document.querySelector('#exam-count');
  if (!board || !count) return;
  const list = getExamSchedule();
  const picked = new Set(getState().goal.examShows || []);
  const admin = isAdminUser();
  const legend = board.querySelector('legend');
  board.innerHTML = `${legend ? legend.outerHTML : '<legend>Lịch thi</legend>'}
    <ul class="exam-list">
      ${list.map((e) => {
        const single = !!e.single;
        const dates = single ? [(e.dates || [])[0] || ''] : (e.dates || []);
        return `
        <li class="exam-row" data-id="${e.id}">
          <label class="exam-pick"><input type="checkbox" data-show="${e.id}" ${picked.has(e.id) ? 'checked' : ''}><span class="exam-name">${escapeHtml(e.name)}</span></label>
          <div class="exam-rounds">
            ${dates.filter((d) => single || d).map((d, i) => roundRow(e.id, d, i, admin, single)).join('')}
            ${!single && !dates.length && !admin ? '<span class="exam-date">Chưa chốt</span>' : ''}
            ${single && !admin && !dates[0] ? '<span class="exam-date">Chưa chốt</span>' : ''}
            ${admin && !single ? '<button type="button" class="link-btn" data-add-round>Thêm đợt</button>' : ''}
          </div>
        </li>`;
      }).join('')}
    </ul>
    ${admin ? '<button type="button" class="btn btn-soft btn-sm" id="exam-save">Lưu lịch thi</button>' : '<p class="small muted">Tích để hiện kỳ đó trên mục tiêu.</p>'}
  `;
  const renumber = (row) => row.querySelectorAll('.round-label').forEach((el, i) => { el.textContent = `Đợt ${i + 1}`; });
  board.onclick = (e) => {
    const add = e.target.closest('[data-add-round]');
    if (add) {
      const row = add.closest('.exam-row');
      const box = row.querySelector('.exam-rounds');
      const hold = document.createElement('div');
      hold.innerHTML = roundRow(row.dataset.id, '', box.querySelectorAll('.exam-round').length, true, false);
      box.insertBefore(hold.firstElementChild, add);
      renumber(row);
      return;
    }
    const del = e.target.closest('[data-del-round]');
    if (!del) return;
    const row = del.closest('.exam-row');
    del.closest('.exam-round').remove();
    renumber(row);
  };
  board.querySelectorAll('[data-show]').forEach((el) => el.onchange = () => {
    const ids = [...board.querySelectorAll('[data-show]:checked')].map((x) => x.dataset.show);
    const visible = getExamSchedule().filter((e) => ids.includes(e.id));
    update((s) => {
      s.goal.examShows = ids;
      s.goal.examDate = nearestDate(visible);
    }, { type: 'sidebar-ui' });
    paintShown();
  });
  const save = board.querySelector('#exam-save');
  if (save) save.onclick = async () => {
    const dates = {};
    board.querySelectorAll('.exam-row').forEach((row) => {
      dates[row.dataset.id] = [...row.querySelectorAll('[data-exam]')].map((el) => el.value).filter(Boolean);
    });
    save.disabled = true;
    try {
      await saveExamSchedule(dates);
      update((s) => { s.goal.examDate = nearestDate(shownExams()); }, { type: 'sidebar-ui' });
      toast('Đã cập nhật lịch thi');
      paintShown();
      save.disabled = false;
    } catch (err) {
      toast(err.message || 'Không lưu được lịch thi', { kind: 'error' });
      save.disabled = false;
    }
  };
  paintShown();
  renderSidebar();
}

function paintShown() {
  const box = document.querySelector('#exam-shown');
  const count = document.querySelector('#exam-count');
  const left = document.querySelector('#goal-left');
  if (box) box.innerHTML = '';
  if (!count) return;
  const list = getExamSchedule();
  const today = todayKey();
  const next = nearestDate(list);
  const days = next ? daysBetween(today, next) : null;
  if (left) left.textContent = days === null ? '—' : days >= 0 ? `${days} ngày` : 'Đã thi';
  count.hidden = false;
  count.innerHTML = `
    <h4 class="side-title">Đếm ngược</h4>
    <div class="count-grid">
      ${list.map((e) => {
        const dates = e.dates || [];
        const next = dates.filter((d) => d >= today).sort()[0] || '';
        const lines = !dates.length
          ? '<strong>Chưa chốt</strong>'
          : e.single
            ? `<strong>${dayText(dates[0], today)}</strong>`
            : dates.map((d, i) => `<div class="round-line ${d === next ? 'is-next' : ''}"><span>Đợt ${i + 1}</span><strong>${dayText(d, today)}</strong></div>`).join('');
        return `<div class="count-card"><small>${escapeHtml(e.short || e.name)}</small>${lines}</div>`;
      }).join('')}
    </div>`;
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
