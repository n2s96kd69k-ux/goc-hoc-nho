const mobile = matchMedia('(max-width: 768px)');
const preferenceKey = 'ghn_sidebar_collapsed';
const sidebar = () => document.getElementById('sidebar');
const toggle = () => document.getElementById('menu-btn');
const backdrop = () => document.getElementById('drawer-backdrop');
const drawerOpen = () => mobile.matches && document.body.classList.contains('drawer-open');

function sync() {
  const side = sidebar();
  const button = toggle();
  const open = drawerOpen();
  const shown = mobile.matches ? open : !document.body.classList.contains('sidebar-collapsed');
  side.inert = !shown;
  side.setAttribute('aria-hidden', String(!shown));
  if (open) {
    side.setAttribute('role', 'dialog');
    side.setAttribute('aria-modal', 'true');
  } else {
    side.removeAttribute('role');
    side.removeAttribute('aria-modal');
  }
  for (const element of document.querySelectorAll('#app-header, .right-content, #main, #bottom-nav, #timer-pill, #notification-panel, #skip-link')) {
    element.inert = open;
  }
  button?.setAttribute('aria-expanded', String(shown));
  button?.setAttribute('aria-label', shown ? 'Ẩn thanh bên' : 'Hiện thanh bên');
}

export function closeSidebarDrawer({ restoreFocus = true } = {}) {
  if (!document.body.classList.contains('drawer-open')) return;
  document.body.classList.remove('drawer-open');
  sync();
  if (restoreFocus) toggle()?.focus();
}

export function bindSidebarToggle(button) {
  sync();
  button.onclick = () => {
    if (mobile.matches) {
      document.body.classList.add('drawer-open');
      sync();
      sidebar().querySelector('#close-sidebar')?.focus();
    } else {
      const collapsed = document.body.classList.toggle('sidebar-collapsed');
      try { localStorage.setItem(preferenceKey, collapsed ? '1' : '0'); } catch {}
      sync();
    }
  };
}

export function startSidebarNavigation() {
  try {
    if (localStorage.getItem(preferenceKey) === '1') document.body.classList.add('sidebar-collapsed');
  } catch {}
  sync();
  backdrop().onclick = () => closeSidebarDrawer();
  sidebar().addEventListener('click', event => {
    if (event.target.closest('#close-sidebar')) closeSidebarDrawer();
  });
  mobile.addEventListener('change', () => {
    closeSidebarDrawer({restoreFocus:false});
    if (mobile.matches && sidebar().contains(document.activeElement)) toggle()?.focus();
    sync();
  });
  document.addEventListener('keydown', event => {
    if (!drawerOpen() || document.querySelector('#modal-root')?.children.length) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSidebarDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const side = sidebar();
    const items = [...side.querySelectorAll('button:not([disabled]), a[href]')].filter(item => item.getClientRects().length);
    const first = items[0];
    const last = items.at(-1);
    if (!first) return;
    if (!side.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)
      || (!event.shiftKey && document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
}
