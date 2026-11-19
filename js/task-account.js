import { getCurrentUser } from './cloud.js';
import { applyServerTask, serverTaskRows, walletMode } from './wallet-account.js';
import { sendWalletCommand } from './wallet-api.js';

const pending = new Map();
const inFlight = new Set();
const rejected = new Set([
  'access-denied', 'migration-required', 'operation-conflict', 'invalid-task-fields',
  'task-version-conflict', 'task-id-in-use', 'task-not-found', 'undo-insufficient-funds', 'subject-not-found', 'too-many-tasks',
]);

export function visibleTasks(legacy) {
  return walletMode() === 'legacy' ? legacy : serverTaskRows() || [];
}

export async function sendTask(type, task, fields) {
  const user = getCurrentUser();
  if (walletMode() !== 'server' || !user || !serverTaskRows()) {
    throw new Error('Chưa tải được nhiệm vụ từ máy chủ. Hãy thử lại khi có mạng.');
  }
  const intent = { type, taskId: task?.id, expectedVersion: task?.version, fields };
  const key = 'goc-hoc-nho:pending-task:' + user.uid + ':' + JSON.stringify(intent);
  if (inFlight.has(key)) throw new Error('Đang xử lý thao tác này.');
  let command = pending.get(key);
  if (!command) {
    try { command = JSON.parse(sessionStorage.getItem(key)); }
    catch { /* Có thể lưu mã tạm trong phiên đang mở. */ }
  }
  if (!command) command = { ...intent, taskId: type === 'task-create' ? crypto.randomUUID() : task?.id, operationId: crypto.randomUUID() };
  pending.set(key, command);
  try { sessionStorage.setItem(key, JSON.stringify(command)); }
  catch { /* Mã vẫn dùng lại được trong tab đang mở. */ }
  const clear = () => {
    pending.delete(key);
    try { sessionStorage.removeItem(key); }
    catch { /* Không còn mã tạm trong bộ nhớ. */ }
  };

  inFlight.add(key);
  try {
    const result = await sendWalletCommand(user.uid, command);
    clear();
    if (result.task) applyServerTask(user.uid, result.task);
    return result;
  } catch (error) {
    if (rejected.has(error.code)) clear();
    throw error;
  } finally {
    inFlight.delete(key);
  }
}
