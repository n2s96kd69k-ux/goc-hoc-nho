// ===== Modal / Drawer dùng chung =====
import { h } from '../utils.js';

const root = () => document.getElementById('modal-root');

export function openModal({ title = '', content = '', size = 'md', onClose = null, hideClose = false } = {}) {
  const wrap = h(`
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${title || 'Hộp thoại'}">
      <div class="modal modal-${size}">
        <div class="modal-head">
          <h3 class="modal-title">${title}</h3>
          ${hideClose ? '' : '<button class="icon-btn modal-close" type="button" aria-label="Đóng">✕</button>'}
        </div>
        <div class="modal-body"></div>
      </div>
    </div>`);
  const body = wrap.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content; else body.appendChild(content);
  root().appendChild(wrap);
  document.body.classList.add('modal-open');

  const close = () => {
    wrap.classList.add('closing');
    setTimeout(() => {
      wrap.remove();
      if (!root().children.length) document.body.classList.remove('modal-open');
      if (onClose) onClose();
    }, 200);
  };
  if (!hideClose) {
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    const esc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
  }
  const closeBtn = wrap.querySelector('.modal-close');
  if (closeBtn) closeBtn.addEventListener('click', close);
  requestAnimationFrame(() => wrap.classList.add('open'));
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
