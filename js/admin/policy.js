export function coinChange(current, amount, mode) {
  if (!Number.isSafeInteger(current) || current < 0) throw new Error('Số dư tài khoản không hợp lệ.');
  if (!['add', 'set'].includes(mode) || !Number.isSafeInteger(amount) || amount < (mode === 'add' ? 1 : 0) || amount > 1000000) throw new Error('Nhập số xu nguyên, tối đa 1.000.000 mỗi lần.');
  const after = mode === 'set' ? amount : current + amount;
  if (after > 1000000000) throw new Error('Số dư vượt giới hạn.');
  return { before: current, after, delta: after - current };
}
export function validateReason(reason) {
  const value = String(reason || '').trim();
  if (value.length < 3 || value.length > 300) throw new Error('Lý do cần từ 3 đến 300 ký tự.');
  return value;
}
export function canChangeAccess(actorUid, targetUid, target) {
  return actorUid !== targetUid && target.owner !== true;
}
