import { exportAccountBackup, restoreAccountPreferences } from '../account-backup.js';
import { walletMode } from '../wallet-account.js';
import { mascotSVG } from '../mascot.js';
import { getCurrentUser } from '../cloud.js';
// ===== Trang /settings =====
import { getState, update, replaceState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { exportToFile, parseImportFile, clearState } from '../storage.js';
import { createBlankState } from '../seed.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openSubjectForm } from './subjects.js';
import { navigate } from '../router.js';
import { SIDEBAR_BLOCKS, sidebarOn } from '../components/sidebar.js';
import { setupDurations } from '../timer.js';
import { recomputeStreak } from '../gamification.js';

export function renderSettings(root) {
  const s = getState();
  const actor = getCurrentUser();
  const mode = walletMode();
  const importedPreferences = mode === 'server';
  const canCleanUp = mode === 'legacy' && (!s._syncUid || s._syncUid === actor?.uid);
  const sameContext = () => getCurrentUser() === actor && walletMode() === mode
    && (!getState()._syncUid || getState()._syncUid === actor?.uid);
  let beforeSync = null;
  try { beforeSync = JSON.parse(localStorage.getItem('goc-hoc-nho:before-first-sync:' + getCurrentUser()?.uid)); } catch {}
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
          <h4 class="side-title">📌 Thanh bên trái</h4>
          <p class="small muted">Bật hoặc ẩn từng phần. Lịch và mục tiêu được bật sẵn.</p>
          <div class="side-switches">
            ${SIDEBAR_BLOCKS.map((b) => `
              <label class="switch">
                <input type="checkbox" data-side="${b.key}" ${sidebarOn(s.settings, b.key) ? 'checked' : ''}>
                <span class="switch-track"></span>
                <span style="display:inline-flex;align-items:center;gap:6px">${b.key === 'mascot' ? `<span aria-hidden="true" style="display:inline-flex">${mascotSVG(24)}</span>` : ''}${escapeHtml(b.label)}</span>
              </label>`).join('')}
          </div>
        </div>

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
          <p class="small muted">${importedPreferences
            ? 'Xuất nhiệm vụ, thống kê, xu và kho đồ để lưu bản đối chiếu. Có thể nhập lại cài đặt, mục tiêu và ghi chú.'
            : 'Xuất file JSON để giữ một bản sao dữ liệu hoặc chuyển sang máy khác.'}</p>
          <div class="btn-row">
            <button type="button" class="btn btn-soft" id="export-btn">📤 Xuất dữ liệu</button>
            ${beforeSync ? '<button type="button" class="btn btn-soft" id="export-before-sync">Tải bản sao trước đồng bộ lần đầu</button>' : ''}
            <button type="button" class="btn btn-soft" id="choose-backup" ${mode === 'unavailable' ? 'disabled' : ''}>${importedPreferences ? '📥 Nhập cài đặt và ghi chú' : '📥 Nhập dữ liệu'}</button>
            <input type="file" id="import-file" accept="application/json,.json" hidden>
          </div>
        </div>

        <div class="paper danger-zone">
          <h4 class="side-title">🧹 Dọn dẹp</h4>
          ${canCleanUp ? `<p class="small muted">Xóa các nhiệm vụ và ngày học mẫu. Việc bạn tự thêm, xu, môn học và phòng được giữ.</p>
          <div class="btn-row">
            <button type="button" class="btn btn-ghost" id="clear-sample">Xóa dữ liệu mẫu</button>
            <button type="button" class="btn btn-danger" id="clear-all">Xóa toàn bộ dữ liệu</button>
          </div>` : `<p class="small muted">${importedPreferences
            ? 'Tài khoản dùng ví máy chủ cần xử lý dọn dẹp qua hệ thống quản lý dữ liệu.'
            : 'Cần tải xong dữ liệu tài khoản để mở tùy chọn dọn dẹp.'}</p>`}
        </div>
      </div>
    </section>`;

  root.querySelector('#export-before-sync')?.addEventListener('click', () => {
    if (!sameContext()) { toast('Tài khoản đã thay đổi. Hãy mở lại Cài đặt.', {kind:'error'}); return; }
    exportToFile(beforeSync);
  });
  const form = root.querySelector('#settings-form');
  form.sound.onchange = () => { root.querySelector('#sound-label').textContent = form.sound.checked ? 'BẬT' : 'TẮT'; };
  form.onsubmit = (e) => {
    e.preventDefault();
    const saved = update((st) => {
      st.settings.userName = form.userName.value.trim() || 'Bạn nhỏ';
      st.settings.focusMinutes = Math.max(1, Number(form.focusMinutes.value) || 25);
      st.settings.breakMinutes = Math.max(1, Number(form.breakMinutes.value) || 5);
      st.settings.sound = form.sound.checked;
    }, { type: 'settings' });
    setupDurations();
    toast(saved ? 'Đã lưu cài đặt trên thiết bị ✨' : 'Cài đặt chưa lưu được. Hãy tải bản sao dữ liệu.', { kind: saved ? '' : 'error' });
  };
  root.querySelectorAll('[data-side]').forEach((input) => {
    input.onchange = () => update((st) => {
      st.settings.sidebar = { ...(st.settings.sidebar || {}), [input.dataset.side]: input.checked };
    }, { type: 'sidebar-ui' });
  });
  root.querySelectorAll('[data-edit-sub]').forEach((b) => b.onclick = () => openSubjectForm(b.dataset.editSub));
  root.querySelector('#add-sub').onclick = () => openSubjectForm();
  root.querySelector('#go-goal').onclick = () => navigate('/goals');
  root.querySelector('#export-btn').onclick = () => {
    try { exportAccountBackup(); toast('Đã tạo file sao lưu 📤'); }
    catch (error) { toast(error.message, {kind:'error'}); }
  };
  const picker = root.querySelector('#import-file');
  root.querySelector('#choose-backup').onclick = () => picker.click();
  picker.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('File vượt quá giới hạn 5 MB.');
      const text = await file.text();
      if (!sameContext() || mode === 'unavailable') throw new Error('Tài khoản đã thay đổi. Hãy mở lại Cài đặt.');
      const data = parseImportFile(text, {allowReference:importedPreferences});
      if (importedPreferences) {
        const ok = await confirmDialog({
          title: 'Nhập cài đặt, mục tiêu và ghi chú?',
          message: 'Các cài đặt, mục tiêu và ghi chú có trong file sẽ thay thế nội dung tương ứng trên tài khoản.',
          okText: 'Áp dụng', danger: true,
        });
        if (!ok) return;
        if (!sameContext() || getState()._syncUid !== actor?.uid) throw new Error('Chưa đồng bộ xong tài khoản. Hãy thử lại.');
        const saved = restoreAccountPreferences(data);
        toast(saved ? 'Đã lưu cài đặt và ghi chú trên thiết bị. Đang chờ đồng bộ.'
          : 'Đã nạp cài đặt vào phiên này. Thiết bị chưa lưu được.', {kind:saved ? '' : 'error'});
        return;
      }
      const ok = await confirmDialog({
        title: 'Nhập dữ liệu?',
        message: `File có <strong>${data.tasks.length}</strong> nhiệm vụ, <strong>${data.subjects.length}</strong> môn, <strong>${escapeHtml(String(data.wallet.coins))}</strong> xu.<br>Dữ liệu hiện tại sẽ bị ghi đè.`,
        okText: 'Nhập & ghi đè', danger: true,
      });
      if (!ok) return;
      if (!sameContext()) throw new Error('Tài khoản đã thay đổi. Hãy mở lại Cài đặt.');
      replaceState(data);
      toast('Đã nạp bản sao vào phiên này 🌷');
      navigate('/');
    } catch (err) {
      toast(err.message || 'File không hợp lệ', { icon: '⚠️' });
    } finally {
      e.target.value = '';
    }
  };

  if (!canCleanUp) return;

  root.querySelector('#clear-sample').onclick = async () => {
    const cur = getState();
    const n = cur.tasks.filter((t) => t.sample).length;
    const days = Object.values(cur.days).filter((d) => d && d.sample).length;
    if (!n && !days) { toast('Không còn dữ liệu mẫu'); return; }
    const ok = await confirmDialog({ title: 'Xóa dữ liệu mẫu?', message: `Xóa <strong>${n}</strong> nhiệm vụ mẫu và lịch sử mẫu. Nhiệm vụ bạn tự thêm, xu, môn học và phòng được giữ.`, okText: 'Xóa mẫu', danger: true });
    if (!ok || !sameContext()) return;
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
    if (!ok2 || !sameContext()) return;
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
