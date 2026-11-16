// Shared state; receipt flags are private to each account on this browser.
let scope = 'guest', items = [], read = new Set(), dismissed = new Set(), opened = false;
const listeners = new Set();
const key = () => `ghn:notifications:${scope}`;
function persist() { try { localStorage.setItem(key(), JSON.stringify({ items, read: [...read], dismissed: [...dismissed] })); } catch {} }
function emit() { persist(); for (const fn of listeners) fn(snapshot()); }
export function snapshot() { return { items: items.map(n => ({ ...n, isRead: read.has(n.id) })), dismissed: new Set(dismissed), opened }; }
export function subscribeNotifications(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); }
export function selectAccount(uid) {
  scope = uid || 'guest'; opened = false; items = []; read = new Set(); dismissed = new Set();
  try { const saved = JSON.parse(localStorage.getItem(key())); items = Array.isArray(saved?.items) ? saved.items : []; read = new Set(saved?.read || []); dismissed = new Set(saved?.dismissed || []); } catch {}
  emit();
}
export function receiveNotifications(list) {
  const merged = new Map(items.map(n => [n.id, n]));
  for (const n of list) {
    if (!n.id || !['global_banner','personal'].includes(n.type) || typeof n.content !== 'string') continue;
    merged.set(n.id, { id: n.id, type: n.type, content: n.content, createdAt: n.createdAt || 0 });
    if (opened) read.add(n.id);
  }
  items = [...merged.values()].sort((a,b) => b.createdAt - a.createdAt).slice(0,200);
  emit();
}
export function dismissBanner(id) { dismissed.add(id); emit(); }
export function openNotifications(value) { opened = value; if (value) items.forEach(n => read.add(n.id)); emit(); }
