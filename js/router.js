// ===== Router hash đơn giản cho SPA =====
const routes = {};
let current = null;
const listeners = new Set();

export function registerRoute(path, render) { routes[path] = render; }

export function currentRoute() { return current; }

export function onRoute(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function navigate(path) {
  if (location.hash !== '#' + path) location.hash = path;
  else handle();
}

function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = raw.split('?');
  const params = Object.fromEntries(new URLSearchParams(query));
  return { path: path.startsWith('/') ? path : '/' + path, params };
}

function handle() {
  const { path, params } = parse();
  const render = routes[path] || routes['/'];
  current = { path: routes[path] ? path : '/', params };
  render(params);
  for (const fn of listeners) fn(current);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function startRouter() {
  window.addEventListener('hashchange', handle);
  handle();
}
