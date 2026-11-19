import { currentRoute, onRoute } from '../router.js';
import { snapshot, subscribeNotifications, dismissBanner, openNotifications } from './store.js';
import { escapeHtml as esc } from '../utils.js';

export const bellHTML = `<button class="icon-btn notification-bell" id="notification-bell" type="button" aria-label="Thông báo" aria-expanded="false" aria-controls="notification-panel"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notification-count" aria-hidden="true" hidden></span></button>`;

const bellButton = () => document.getElementById('notification-bell');
const closeButton = () => document.getElementById('close-notifications');
const dateFormat = new Intl.DateTimeFormat('vi-VN', {dateStyle:'short', timeStyle:'short'});

function closePanel(restoreFocus = false) {
  if (!snapshot().opened) return;
  openNotifications(false);
  if (restoreFocus) bellButton()?.focus();
}

export function bindBell() {
  const bell = bellButton();
  if (bell) bell.onclick = () => {
    if (snapshot().opened) closePanel(true);
    else {
      openNotifications(true);
      closeButton()?.focus();
    }
  };
  paint(snapshot());
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  if (!timestamp || !Number.isFinite(date.getTime())) return '';
  return `<time datetime="${date.toISOString()}">${esc(dateFormat.format(date))}</time>`;
}

function paintPanel(state) {
  const bell = bellButton();
  if (bell) {
    const unread = state.items.filter(item => !item.isRead).length;
    bell.setAttribute('aria-expanded', String(state.opened));
    bell.setAttribute('aria-label', unread ? `Thông báo, ${unread} chưa đọc` : 'Thông báo');
    const badge = bell.querySelector('span');
    badge.hidden = unread === 0;
    badge.textContent = unread > 99 ? '99+' : unread;
  }
  const panel = document.getElementById('notification-panel');
  if (!panel) return;
  panel.hidden = !state.opened;
  const list = panel.querySelector('#notification-items');
  if (!list) return;
  if (!state.opened) {
    list.replaceChildren();
    return;
  }
  list.innerHTML = state.items.length ? `<ul>${state.items.map(item => `
    <li><small>${item.type === 'global_banner' ? 'Thông báo chung' : 'Dành cho bạn'}</small>
    <p>${esc(item.content)}</p>${formatTime(item.createdAt)}</li>`).join('')}</ul>`
    : '<p class="notification-empty">Chưa có thông báo mới. Chúc bạn học tốt nhé!</p>';
}

function paintBanner(state) {
  const wrapper = document.getElementById('notification-banner');
  if (!wrapper) return;
  const overview = currentRoute()?.path === '/';
  wrapper.hidden = !overview;
  const next = overview && state.items.find(item => item.type === 'global_banner' && !state.dismissed.has(item.id));
  wrapper.inert = !next;
  wrapper.classList.toggle('visible', !!next);
  if (!next) return;
  const title = wrapper.querySelector('.notification-banner-content');
  if (!title) return;
  if (title.textContent !== next.content) title.textContent = next.content;
  wrapper.querySelector('.notification-banner-close').onclick = () => {
    document.getElementById('main')?.focus({preventScroll:true});
    dismissBanner(next.id);
  };
}

function paint(state) {
  paintPanel(state);
  paintBanner(state);
}

export function initNotificationUI() {
  closeButton()?.addEventListener('click', () => closePanel(true));
  subscribeNotifications(paint);
  onRoute(() => {
    if (snapshot().opened) closePanel();
    else paint(snapshot());
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('#notification-panel, #notification-bell')) closePanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !snapshot().opened
        || document.querySelector('#modal-root')?.children.length) return;
    event.preventDefault();
    closePanel(true);
  });
}
