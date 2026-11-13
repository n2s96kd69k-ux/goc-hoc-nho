// ===== Hộp thoại Tài khoản & Đồng bộ đám mây =====
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { getState } from '../state.js';
import {
  getCurrentUser,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logoutCloud,
  saveCloudState,
  friendlyAuthError,
} from '../cloud.js';
import { escapeHtml } from '../utils.js';

export function openAuthModal() {
  const user = getCurrentUser();
  if (user) {
    const label = escapeHtml(user.displayName || user.email || 'Tài khoản');
    const email = escapeHtml(user.email || '');
    const m = openModal({
      title: '☁️ Tài khoản đồng bộ',
      size: 'sm',
      content: `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.06);">
            <div style="font-weight:700;font-size:15px;">${label}</div>
            ${email ? `<div style="font-size:13px;opacity:0.75;">${email}</div>` : ''}
            <div style="font-size:12px;margin-top:6px;color:#2e7d32;">✓ Tự động lưu dữ liệu lên đám mây</div>
          </div>
          <div class="modal-actions" style="justify-content:space-between;">
            <button class="btn btn-ghost" id="cloud-sync-now" type="button">🔄 Đồng bộ ngay</button>
            <button class="btn btn-danger" id="cloud-logout-btn" type="button">Đăng xuất</button>
          </div>
        </div>
      `,
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
      await logoutCloud();
      m.close();
      toast('Đã đăng xuất tài khoản.');
    };
    return;
  }

  let mode = 'login';
  const m = openModal({
    title: '☁️ Đăng nhập để lưu dữ liệu',
    size: 'sm',
    content: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <p style="margin:0;font-size:13px;opacity:0.8;">Đăng nhập để đồng bộ nhiệm vụ, xu và góc học giữa điện thoại và máy tính.</p>
        <button class="btn btn-ghost" id="auth-google-btn" type="button" style="width:100%;justify-content:center;">
          <span>🔵 Tiếp tục với Google</span>
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
      </div>
    `,
  });

  const errEl = m.body.querySelector('#auth-err');
  const submitBtn = m.body.querySelector('#auth-submit-btn');
  const toggleBtn = m.body.querySelector('#auth-toggle-mode');

  const showErr = (msg) => {
    errEl.textContent = msg;
    errEl.style.display = 'block';
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
