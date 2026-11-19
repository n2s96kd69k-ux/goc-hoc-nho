import { doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, getCurrentUser } from './cloud.js';
import { activeFocusId, subscribeWallet, walletMode } from './wallet-account.js';
import { sendWalletCommand } from './wallet-api.js';

const listeners = new Set();
const pending = new Map();
let user;
let mode;
let sessionId;
let session;
let stop = () => {};

const startKey = uid => 'goc-hoc-nho:pending-focus-start:' + uid;

function readCommand(key) {
  if (pending.has(key)) return pending.get(key);
  try { return JSON.parse(sessionStorage.getItem(key)); }
  catch { return null; }
}

function clearCommand(key) {
  pending.delete(key);
  try { sessionStorage.removeItem(key); }
  catch { /* Không còn lệnh trong bộ nhớ. */ }
}

function publish() {
  listeners.forEach(listener => listener(session));
}

export function subscribeFocus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startFocusAccount() {
  const connect = () => {
    const nextUser = getCurrentUser();
    const nextMode = walletMode();
    const nextId = activeFocusId();
    if (user === nextUser && mode === nextMode && sessionId === nextId) return;
    stop();
    user = nextUser;
    mode = nextMode;
    sessionId = nextId;
    session = nextId === null ? null : undefined;
    publish();
    if (!nextId || !nextUser || nextMode !== 'server') return;
    const key = startKey(nextUser.uid);
    if (readCommand(key)?.sessionId === nextId) clearCommand(key);
    let alive = true;
    const unsubscribe = onSnapshot(doc(firebaseDb(), 'users', nextUser.uid, 'focusSessions', nextId), snapshot => {
      if (!alive || getCurrentUser() !== nextUser || activeFocusId() !== nextId) return;
      const row = snapshot.data();
      if (!row || !['running', 'paused'].includes(row.status)) session = null;
      else if ([row.durationMs, row.elapsedMs, row.resumedAt, row.expiresAt].every(Number.isFinite)
          && row.durationMs > 0 && row.elapsedMs >= 0) session = { ...row, id: nextId };
      else session = undefined;
      publish();
    }, () => {
      if (!alive) return;
      session = undefined;
      publish();
    });
    stop = () => { alive = false; unsubscribe(); };
  };
  subscribeWallet(connect);
  connect();
}

export function focusSession() {
  return user === getCurrentUser() && mode === 'server' && walletMode() === 'server' ? session : undefined;
}

const retryable = new Set(['unknown', 'database-error', 'service-auth-failed', 'focus-too-early']);

export async function sendFocus(type, options = {}) {
  const actor = getCurrentUser();
  if (!actor || walletMode() !== 'server') throw new Error('Phiên đăng nhập đã thay đổi.');
  const key = type === 'focus-start' ? startKey(actor.uid)
    : 'goc-hoc-nho:pending-focus:' + actor.uid + ':' + JSON.stringify({ type, ...options });
  const command = readCommand(key) || {
    type, ...options, sessionId: options.sessionId || crypto.randomUUID(), operationId: crypto.randomUUID(),
  };
  pending.set(key, command);
  try { sessionStorage.setItem(key, JSON.stringify(command)); }
  catch { /* Lệnh vẫn được giữ trong tab này. */ }

  try {
    const result = await sendWalletCommand(actor.uid, command);
    clearCommand(key);
    return result;
  } catch (error) {
    if (error.code && !retryable.has(error.code)) clearCommand(key);
    throw error;
  }
}
