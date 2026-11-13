// ===== Trang /settings =====
import { getState, update, replaceState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { exportToFile, parseImportFile, clearState } from '../storage.js';
import { createBlankState } from '../seed.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openSubjectForm } from './subjects.js';
import { navigate } from '../router.js';
import { setupDurations } from '../timer.js';
import { recomputeStreak } from '../gamification.js';

export function renderSettings(root) {
  const s = getState();
  root.innerHTML = `
    <section class="page settings-page">
      <h1 class="page-title">⚙ CÀI ĐẶT</h1>
      <p class="page-sub">Chỉnh góc học theo ý mình.</p>

      <div class="settings-grid">
        <form class="paper task-form" id="settings-form">
          <h4 class="side-title">👤 Cá nhân</h4>
          <label class="field"><span>Tên của bạn</span><input name="userName" maxlength="30" value="${escapeHtml(s.settings.userName)}"></label>
          <div class="field-row">
            <label class="field"><span>Pomodoro (phút)</span><input type="number" name="focusMinutes" min="1" max="180" value="${s.settings.focusMinutes}"></label>
            <label class="field"><span>Nghỉ (phút)</span><input type="number" name="breakMinutes" min="1" max="60" value="${s.settings.breakMinutes}"></label>
          </div>
          <label class="switch">
            <input type="checkbox" name="sound" ${s.settings.sound ? 'checked' : ''}>
            <span class="switch-track"></span>
            <span>🔊 Âm thanh: <strong id="sound-label">${s.settings.sound ? 'BẬT' : 'TẮT'}</strong></span>
          </label>
          <div class="modal-actions"><button class="btn btn-primary" type="submit">Lưu cài đặt</button></div>
        </form>

        <div class="paper">
          <h4 class="side-title">📚 Môn học</h4>
          <ul class="settings-list">
            ${s.subjects.map((sub) => `<li><span><i class="subject-dot" style="background:${sub.color}"></i>${sub.icon} ${escapeHtml(sub.name)}</span><button type="button" class="btn btn-ghost btn-sm" data-edit-sub="${sub.id}">Sửa</button></li>`).join('')}
          </ul>
          <button type="button" class="btn btn-soft btn-sm" id="add-sub">+ Thêm môn</button>
          <h4 class="side-title mt">🎯 Mục tiêu</h4>
          <p class="small">${s.goal.icon} ${escapeHtml(s.goal.name || 'Chưa đặt')} ${s.goal.examDate ? '· ' + s.goal.examDate : ''}</p>
          <button type="button" class="btn btn-soft btn-sm" id="go-goal">Chỉnh mục tiêu</button>
        </div>

        <div class="paper">
          <h4 class="side-title">💾 Sao lưu</h4>
          <p class="small muted">Dữ liệu chỉ nằm trên trình duyệt này. Xuất file JSON để giữ lại hoặc chuyển sang máy khác.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-soft" id="export-btn">📤 Xuất dữ liệu</button>
            <label class="btn btn-soft" for="import-file">📥 Nhập dữ liệu</label>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
          </div>
        </div>

        <div class="paper danger-zone">
          <h4 class="side-title">🧹 Dọn dẹp</h4>
          <p class="small muted">Xóa các nhiệm vụ và ngày học mẫu. Việc bạn tự thêm, xu, môn học và phòng được giữ.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="clear-sample">Xóa dữ liệu mẫu</button>
            <button type="button" class="btn btn-danger" id="clear-all">Xóa toàn bộ dữ liệu</button>
          </div>
        </div>
      </div>
    </section>`;

  const form = root.querySelector('#settings-form');
  form.sound.onchange = () => { root.querySelector('#sound-label').textContent = form.sound.checked ? 'BẬT' : 'TẮT'; };
  form.onsubmit = (e) => {
    e.preventDefault();
    update((st) => {
      st.settings.userName = form.userName.value.trim() || 'Bạn nhỏ';
      st.settings.focusMinutes = Math.max(1, Number(form.focusMinutes.value) || 25);
      st.settings.breakMinutes = Math.max(1, Number(form.breakMinutes.value) || 5);
      st.settings.sound = form.sound.checked;
    }, { type: 'settings' });
    setupDurations();
    toast('Đã lưu cài đặt ✨');
  };
  root.querySelectorAll('[data-edit-sub]').forEach((b) => b.onclick = () => openSubjectForm(b.dataset.editSub));
  root.querySelector('#add-sub').onclick = () => openSubjectForm();
  root.querySelector('#go-goal').onclick = () => navigate('/goals');
  root.querySelector('#export-btn').onclick = () => { exportToFile(getState()); toast('Đã tải file sao lưu 📤'); };

  root.querySelector('#import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = parseImportFile(text);
      const ok = await confirmDialog({
        title: 'Nhập dữ liệu?',
        message: `File có <strong>${data.tasks.length}</strong> nhiệm vụ, <strong>${data.subjects.length}</strong> môn, <strong>${(data.wallet && data.wallet.coins) || 0}</strong> xu.<br>Dữ liệu hiện tại sẽ bị ghi đè.`,
        okText: 'Nhập & ghi đè', danger: true,
      });
      if (ok) { replaceState(data); toast('Đã nhập dữ liệu 🌷'); navigate('/'); }
    } catch (err) {
      toast(err.message || 'File không hợp lệ', { icon: '⚠️' });
    }
    e.target.value = '';
  };

  root.querySelector('#clear-sample').onclick = async () => {
    const cur = getState();
    const n = cur.tasks.filter((t) => t.sample).length;
    const days = Object.values(cur.days).filter((d) => d && d.sample).length;
    if (!n && !days) { toast('Không còn dữ liệu mẫu'); return; }
    const ok = await confirmDialog({ title: 'Xóa dữ liệu mẫu?', message: `Xóa <strong>${n}</strong> nhiệm vụ mẫu và lịch sử mẫu. Nhiệm vụ bạn tự thêm, xu, môn học và phòng được giữ.`, okText: 'Xóa mẫu', danger: true });
    if (!ok) return;
    update((st) => {
      const hadUserTask = st.tasks.some((t) => !t.sample);
      st.tasks = st.tasks.filter((t) => !t.sample);
      if (!hadUserTask) {
        st.days = {};
        st.streak.current = 0;
        st.streak.longest = 0;
      } else {
        const kept = {};
        for (const [k, d] of Object.entries(st.days)) if (!d || !d.sample) kept[k] = d;
        st.days = kept;
      }
      st.settings.seeded = false;
    }, { type: 'replace' });
    recomputeStreak();
    toast('Đã xóa dữ liệu mẫu 🌷');
  };

  root.querySelector('#clear-all').onclick = async () => {
    const ok1 = await confirmDialog({ title: 'Xóa toàn bộ dữ liệu?', message: 'Mọi nhiệm vụ, xu, vật phẩm, phòng, thống kê sẽ mất. Bạn nên xuất file sao lưu trước.', okText: 'Tiếp tục', danger: true });
    if (!ok1) return;
    const ok2 = await confirmDialog({ title: 'Chắc chắn chứ? (bước 2/2)', message: 'Hành động này không thể hoàn tác.', okText: 'Xóa hết', danger: true });
    if (!ok2) return;
    const keep = getState();
    const blank = createBlankState();
    blank.settings = { ...keep.settings, seeded: false };
    blank.subjects = keep.subjects;
    blank.goal = keep.goal;
    blank.mascot = { ...blank.mascot, name: keep.mascot.name };
    clearState();
    replaceState(blank);
    toast('Đã xóa toàn bộ dữ liệu');
    navigate('/');
  };
}
