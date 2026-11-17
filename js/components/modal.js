// ===== Modal / Drawer dùng chung =====
import { h, escapeHtml } from '../utils.js';

const root = () => document.getElementById('modal-root');

export function openModal({ title = '', content = '', size = 'md', onClose = null, hideClose = false } = {}) {
  const previousFocus = document.activeElement;
  let closed = false;
  const wrap = h(`
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title || 'Hộp thoại')}">
      <div class="modal modal-${size}">
        <div class="modal-head">
          <h3 class="modal-title">${escapeHtml(title)}</h3>
          ${hideClose ? '' : '<button class="icon-btn modal-close" type="button" aria-label="Đóng">✕</button>'}
        </div>
        <div class="modal-body"></div>
      </div>
    </div>`);
  const body = wrap.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
  root().appendChild(wrap);
  document.body.classList.add('modal-open');

  const focusable = () => [...wrap.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length);
  const keyboard = e => {
    if (root().lastElementChild !== wrap) return;
    if (e.key === 'Escape' && !hideClose) { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { e.preventDefault(); wrap.focus(); return; }
      if (!wrap.contains(document.activeElement) || (e.shiftKey && document.activeElement === first)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  wrap.tabIndex = -1;
  document.addEventListener('keydown', keyboard);
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', keyboard);
    wrap.classList.add('closing');
    setTimeout(() => {
      wrap.remove();
      if (!root().children.length) document.body.classList.remove('modal-open');
      if (previousFocus?.isConnected) previousFocus.focus();
      if (onClose) onClose();
    }, 200);
  };
  if (!hideClose) {
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  }
  const closeBtn = wrap.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  requestAnimationFrame(() => { if (!closed) { wrap.classList.add('open'); (focusable()[0] || wrap).focus(); } });
  return { el: wrap, body, close };
}

export function confirmDialog({ title = 'Bạn chắc chứ?', message = '', okText = 'Đồng ý', cancelText = 'Hủy', danger = false } = {}) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      size: 'sm',
      content: `
        <p class="confirm-msg">${message}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-act="cancel" type="button">${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok" type="button">${okText}</button>
        </div>`,
      onClose: () => resolve(false),
    });
    m.body.querySelector('[data-act="ok"]').onclick = () => { resolve(true); m.el.querySelector('.modal-close').click(); };
    m.body.querySelector('[data-act="cancel"]').onclick = () => m.el.querySelector('.modal-close').click();
  });
}
