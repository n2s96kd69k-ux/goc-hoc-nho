// ===== Hộp thoại Tài khoản & Màn hình Chào mừng / Đăng nhập =====
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { getState, replaceState } from '../state.js';
import { clearState } from '../storage.js';
import { createInitialState } from '../seed.js';
import { mascotSVG } from '../mascot.js';
import {
  getCurrentUser,
  onCloudAuthChange,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logoutCloud,
  saveCloudState,
  friendlyAuthError,
  accountId,
  OWNER_ID,
  loadRoleBook,
  saveRoleBook,
  roleOf,
} from '../cloud.js';
import { escapeHtml } from '../utils.js';

const SKIP_KEY = 'ghn_guest_skip';

const GOOGLE_ICON_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink:0;">
  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"/>
  <path fill="#34A853" d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.08.72-2.46 1.15-4.23 1.15-3.25 0-6.01-2.2-6.99-5.15H1.01v3.14C3.03 21.14 7.21 24 12 24Z"/>
  <path fill="#FBBC05" d="M5.01 13.99c-.25-.72-.39-1.5-.39-2.29s.14-1.57.39-2.29V6.27H1.01C.37 7.55 0 8.98 0 11.7s.37 4.15 1.01 5.43l4-3.14Z"/>
  <path fill="#EA4335" d="M12 4.56c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07.98 15.3 0 12 0 7.21 0 3.03 2.86 1.01 7.01l4 3.14c.98-2.95 3.74-5.59 6.99-5.59Z"/>
</svg>`;

let activeAuthModal = null;

export function openAuthModal({ welcome = false } = {}) {
  if (activeAuthModal) {
    try { activeAuthModal.close(); } catch {}
    activeAuthModal = null;
  }

  const user = getCurrentUser();
  if (user && !welcome) {
    const label = escapeHtml(user.displayName || user.email || 'Tài khoản');
    const email = escapeHtml(user.email || '');
    const pid = accountId(user.uid);
    const m = openModal({
      title: '☁️ Tài khoản đồng bộ',
      size: 'md',
      onClose: () => { activeAuthModal = null; },
      content: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);">
            <div style="font-weight:700;font-size:15px;">${label}</div>
            ${email ? `<div style="font-size:13px;opacity:0.75;">${email}</div>` : ''}
            <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,248,236,0.9);border:1px dashed rgba(111,85,71,0.25);">
              <div>
                <div style="font-size:11px;letter-spacing:.04em;opacity:.65;">ID TÀI KHOẢN</div>
                <div id="account-id" style="font-weight:800;font-size:16px;letter-spacing:.08em;">${pid}</div>
              </div>
              <button class="btn btn-ghost btn-sm" id="copy-account-id" type="button">Sao chép</button>
            </div>
            <div style="font-size:12px;margin-top:6px;color:#2e7d32;">✓ Tự động lưu dữ liệu lên đám mây</div>
          </div>
          <div id="role-box" class="small muted">Đang tải quyền…</div>
          <div class="modal-actions" style="justify-content:space-between;">
            <button class="btn btn-ghost" id="cloud-sync-now" type="button">🔄 Đồng bộ ngay</button>
            <button class="btn btn-danger" id="cloud-logout-btn" type="button">Đăng xuất</button>
          </div>
        </div>
      `,
    });
    activeAuthModal = m;

    m.body.querySelector('#copy-account-id').onclick = async () => {
      try {
        await navigator.clipboard.writeText(pid);
        toast('Đã chép ID ' + pid, { icon: '✓' });
      } catch {
        toast(pid, { icon: '🪪' });
      }
    };

    const roleBox = m.body.querySelector('#role-box');
    const paintRoles = (book) => {
      if (!book.members) book.members = {};
      if (!book.members[OWNER_ID]) book.members[OWNER_ID] = { role: 'admin', owner: true, name: 'Lê Khả Thanh Bình' };
      const mine = roleOf(pid, book);
      const mineLabel = mine === 'admin' ? 'Quản trị viên' : mine === 'member' ? 'Thành viên' : 'Chưa có quyền';
      const rows = Object.entries(book.members).sort((a, b) => (a[0] === OWNER_ID ? -1 : b[0] === OWNER_ID ? 1 : a[0].localeCompare(b[0])));
      roleBox.className = '';
      roleBox.innerHTML = `
        <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong>Người dùng</strong>
            <span class="chip ${mine === 'admin' ? 'active' : ''}">${mineLabel}</span>
          </div>
          <ul class="settings-list" style="margin:0;">
            ${rows.map(([id, row]) => `
              <li>
                <span><strong>${escapeHtml(id)}</strong> · ${escapeHtml(row.name || 'Chưa đặt tên')}<br><small>${row.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}${id === OWNER_ID ? ' · chủ' : ''}</small></span>
                ${mine === 'admin' && id !== OWNER_ID ? `<button type="button" class="btn btn-ghost btn-sm" data-drop="${escapeHtml(id)}">Gỡ</button>` : ''}
              </li>`).join('')}
          </ul>
          ${mine === 'admin' ? `
            <form id="add-member" style="display:flex;flex-direction:column;gap:8px;">
              <input class="input" name="pid" placeholder="ID tài khoản, ví dụ GHN-AB23CD" maxlength="10" required style="text-transform:uppercase;">
              <input class="input" name="name" placeholder="Tên (không bắt buộc)" maxlength="40">
              <label class="field"><span>Quyền</span>
                <select class="input" name="role">
                  <option value="member">Thành viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </label>
              <button class="btn btn-primary btn-sm" type="submit">Thêm người dùng</button>
            </form>` : '<p class="small muted" style="margin:0;">Chỉ quản trị viên thêm hoặc gỡ người dùng.</p>'}
        </div>`;
      if (mine !== 'admin') return;
      roleBox.querySelectorAll('[data-drop]').forEach((b) => b.onclick = async () => {
        const id = b.dataset.drop;
        delete book.members[id];
        try {
          book = await saveRoleBook(user.uid, book);
          paintRoles(book);
          toast('Đã gỡ ' + id);
        } catch (e) {
          toast('Không lưu được: ' + (e.message || 'lỗi quyền'), { kind: 'error' });
        }
      });
      roleBox.querySelector('#add-member').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const id = form.pid.value.trim().toUpperCase();
        if (!/^GHN-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(id)) {
          toast('ID phải dạng GHN- và 6 ký tự', { kind: 'error' });
          return;
        }
        if (id === OWNER_ID) { toast('Chủ đã là quản trị viên'); return; }
        const role = form.role.value === 'admin' ? 'admin' : 'member';
        const name = form.name.value.trim();
        book.members[id] = { role, name, owner: false };
        try {
          book = await saveRoleBook(user.uid, book);
          paintRoles(book);
          toast(role === 'admin' ? 'Đã thêm quản trị viên' : 'Đã thêm thành viên');
        } catch (err) {
          toast('Không lưu được: ' + (err.message || 'lỗi quyền'), { kind: 'error' });
        }
      };
    };
    if (pid === OWNER_ID) paintRoles({ members: {} });
    loadRoleBook(user.uid).then((book) => { if (activeAuthModal === m) paintRoles(book); }).catch((e) => {
      console.warn(e);
      if (pid === OWNER_ID) paintRoles({ members: {} });
      else roleBox.textContent = 'Không tải được danh sách người dùng.';
    });

    m.body.querySelector('#cloud-sync-now').onclick = async () => {
      try {
        await saveCloudState(user.uid, getState());
        toast('Đã lưu dữ liệu lên đám mây ☁️', { icon: '✓' });
      } catch (e) {
        toast('Không đồng bộ được: ' + (e.message || 'Lỗi mạng'), { kind: 'error' });
      }
    };

    m.body.querySelector('#cloud-logout-btn').onclick = async () => {
      const btn = m.body.querySelector('#cloud-logout-btn');
      btn.disabled = true;
      try {
        await saveCloudState(user.uid, getState());
      } catch (e) {
        console.warn('Lưu trước khi đăng xuất lỗi:', e);
      }
      sessionStorage.removeItem(SKIP_KEY);
      await logoutCloud();
      clearState();
      replaceState(createInitialState(), { skipCloud: true });
      m.close();
      toast('Đã đăng xuất tài khoản.');
      setTimeout(() => openAuthModal({ welcome: true }), 260);
    };
    return;
  }

  let mode = 'login';
  const m = openModal({
    title: welcome ? '🌷 Chào mừng đến Góc Học Nhỏ' : '☁️ Đăng nhập để lưu dữ liệu',
    size: 'sm',
    hideClose: welcome,
    onClose: () => { activeAuthModal = null; },
    content: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${welcome ? `
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:4px;padding:4px 0;">
            <div class="mascot-wrap mascot-happy" style="width:58px;height:58px;">${mascotSVG(58)}</div>
            <div style="font-size:13px;opacity:0.82;">“Một góc nhỏ cho những ngày cố gắng.”</div>
          </div>
        ` : ''}
        <p style="margin:0;font-size:13px;opacity:0.8;text-align:${welcome ? 'center' : 'left'};">
          Đăng nhập để lưu kế hoạch ôn thi, xu và căn phòng 2.5D của bạn trên mọi thiết bị.
        </p>
        <button class="btn btn-ghost" id="auth-google-btn" type="button" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;font-weight:700;">
          ${GOOGLE_ICON_SVG}
          <span>Tiếp tục với Google</span>
        </button>
        <div style="text-align:center;font-size:12px;opacity:0.6;">— hoặc dùng Email —</div>
        <form id="auth-email-form" style="display:flex;flex-direction:column;gap:10px;">
          <input class="input" id="auth-email" type="email" placeholder="Email của bạn" required />
          <input class="input" id="auth-pass" type="password" placeholder="Mật khẩu (từ 6 ký tự)" minlength="6" required />
          <div id="auth-err" style="color:#c62828;font-size:12px;display:none;"></div>
          <button class="btn btn-primary" id="auth-submit-btn" type="submit" style="width:100%;justify-content:center;">Đăng nhập</button>
        </form>
        <button class="btn btn-ghost" id="auth-toggle-mode" type="button" style="font-size:12px;justify-content:center;">
          Chưa có tài khoản? Đăng ký mới
        </button>
        <div style="border-top:1px dashed rgba(0,0,0,0.1);padding-top:10px;text-align:center;">
          <button class="btn btn-ghost" id="auth-skip-btn" type="button" style="width:100%;justify-content:center;font-size:12.5px;opacity:0.85;">
            Bỏ qua đăng nhập, dùng thử ngay →
          </button>
        </div>
      </div>
    `,
  });
  activeAuthModal = m;

  if (welcome) {
    // Chặn đóng khi bấm ra ngoài nền mờ nếu đang ở màn hình chào mừng bắt buộc chọn
    m.el.onclick = (e) => { e.stopPropagation(); };
  }

  const errEl = m.body.querySelector('#auth-err');
  const submitBtn = m.body.querySelector('#auth-submit-btn');
  const toggleBtn = m.body.querySelector('#auth-toggle-mode');
  const skipBtn = m.body.querySelector('#auth-skip-btn');

  const showErr = (msg) => {
    errEl.textContent = msg;
    errEl.style.display = 'block';
  };

  skipBtn.onclick = () => {
    sessionStorage.setItem(SKIP_KEY, '1');
    m.close();
    toast('Đang dùng chế độ khách (lưu trên trình duyệt này) 🌱');
  };

  toggleBtn.onclick = () => {
    mode = mode === 'login' ? 'register' : 'login';
    submitBtn.textContent = mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản';
    toggleBtn.textContent = mode === 'login'
      ? 'Chưa có tài khoản? Đăng ký mới'
      : 'Đã có tài khoản? Đăng nhập';
    errEl.style.display = 'none';
  };

  m.body.querySelector('#auth-google-btn').onclick = async () => {
    try {
      await loginWithGoogle();
      m.close();
    } catch (e) {
      showErr(friendlyAuthError(e));
    }
  };

  m.body.querySelector('#auth-email-form').onsubmit = async (e) => {
    e.preventDefault();
    errEl.style.display = 'none';
    const email = m.body.querySelector('#auth-email').value.trim();
    const pass = m.body.querySelector('#auth-pass').value;
    submitBtn.disabled = true;
    try {
      if (mode === 'login') {
        await loginWithEmail(email, pass);
      } else {
        await registerWithEmail(email, pass);
      }
      m.close();
    } catch (err) {
      showErr(friendlyAuthError(err));
      submitBtn.disabled = false;
    }
  };
}

// Tự động hiện màn hình đăng nhập khi mới vào web mà chưa đăng nhập và chưa bấm "Bỏ qua"
let initialAuthChecked = false;
onCloudAuthChange((user) => {
  if (user) {
    initialAuthChecked = true;
    if (activeAuthModal) {
      try { activeAuthModal.close(); } catch {}
      activeAuthModal = null;
    }
    return;
  }
  if (!initialAuthChecked) {
    initialAuthChecked = true;
    if (sessionStorage.getItem(SKIP_KEY) !== '1') {
      setTimeout(() => {
        if (!getCurrentUser() && sessionStorage.getItem(SKIP_KEY) !== '1') {
          openAuthModal({ welcome: true });
        }
      }, 180);
    }
  }
});
