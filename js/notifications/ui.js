import { currentRoute, onRoute } from '../router.js';
import { snapshot, subscribeNotifications, dismissBanner, openNotifications } from './store.js';
import { escapeHtml as esc } from '../utils.js';
export const bellHTML = `<button class="icon-btn notification-bell" id="notification-bell" type="button" aria-label="Thông báo" aria-expanded="false" aria-controls="notification-panel"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" hidden></span></button>`;
let currentBanner = null;
export function bindBell() { const b = document.getElementById('notification-bell'); if (b) b.onclick = () => openNotifications(!snapshot().opened); paint(snapshot()); }
function paint(state) {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  if (bell) {
    const count = state.items.filter(n => !n.isRead).length;
    bell.setAttribute('aria-expanded', String(state.opened)); bell.setAttribute('aria-label', `Thông báo, ${count} chưa đọc`);
    const badge = bell.querySelector('span'); badge.hidden = count === 0; badge.textContent = count > 99 ? '99+' : count;
  }
  if (panel) {
    panel.hidden = !state.opened;
    panel.innerHTML = `<div class="notification-heading"><strong>Thông báo</strong><button class="icon-btn" aria-label="Đóng thông báo" id="close-notifications">×</button></div>${state.items.length ? `<ul>${state.items.map(n => `<li><small>${n.type === 'global_banner' ? 'Thông báo chung' : 'Dành cho bạn'}</small><p>${esc(n.content)}</p>${n.createdAt ? `<time>${esc(new Date(n.createdAt).toLocaleString('vi-VN'))}</time>` : ''}</li>`).join('')}</ul>` : '<p class="notification-empty">Chưa có thông báo mới. Chúc bạn học tốt nhé!</p>'}`;
    panel.querySelector('#close-notifications').onclick = () => { openNotifications(false); bell?.focus(); };
  }
  const wrapper = document.getElementById('notification-banner'); if (!wrapper) return;
  wrapper.hidden = currentRoute()?.path !== '/';
  const next = state.items.find(n => n.type === 'global_banner' && !state.dismissed.has(n.id));
  if (next?.id === currentBanner) return;
  currentBanner = next?.id || null;
  if (next) {
    wrapper.querySelector('.notification-banner-inner').innerHTML = `<div class="notification-banner-bar"><span class="notification-banner-icon" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h4l11 4V6L8 10zM8 14l2 6h3l-2-5M22 10v4"/></svg></span><span class="notification-banner-label">THÔNG BÁO</span><span class="notification-banner-content">${esc(next.content)}</span><button class="notification-banner-close" type="button" aria-label="Ẩn thông báo này">×</button></div>`;
    wrapper.querySelector('button').onclick = () => {
      const id = next.id; wrapper.classList.remove('visible');
      setTimeout(() => dismissBanner(id), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300);
    };
  }
  wrapper.classList.toggle('visible', !!next);
}
export function initNotificationUI() {
  subscribeNotifications(paint);
  onRoute(() => paint(snapshot()));
  document.addEventListener('click', e => { if (snapshot().opened && !e.target.closest('#notification-panel, #notification-bell')) openNotifications(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && snapshot().opened) { openNotifications(false); document.getElementById('notification-bell')?.focus(); } });
}
