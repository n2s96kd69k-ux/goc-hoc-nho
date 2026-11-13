// ===== Toast nhỏ =====
import { h } from '../utils.js';

export function toast(message, { icon = '', duration = 2200, kind = '' } = {}) {
  const root = document.getElementById('toast-root');
  const el = h(`<div class="toast ${kind}">${icon ? `<span class="toast-icon">${icon}</span>` : ''}<span>${message}</span></div>`);
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, duration);
}
