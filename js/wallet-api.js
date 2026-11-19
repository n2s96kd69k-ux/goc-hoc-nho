import { getCurrentUser } from './cloud.js';

const endpoint = 'https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy';
const messages = {
  'unauthenticated': 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  'access-denied': 'Tài khoản không được phép thực hiện thao tác.',
  'admin-required': 'Tài khoản không còn quyền quản trị.',
  'target-unavailable': 'Tài khoản nhận xu đã bị khóa hoặc không còn tồn tại.',
  'migration-required': 'Ví máy chủ chưa sẵn sàng cho tài khoản này.',
  'operation-conflict': 'Mã thao tác đã được dùng cho yêu cầu khác.',
  'insufficient-funds': 'Bạn chưa đủ xu.',
  'quantity-limit': 'Bạn đã sở hữu số lượng tối đa của vật phẩm này.',
  'balance-limit': 'Số dư vượt giới hạn.',
  'earned-limit': 'Tổng xu đã nhận vượt giới hạn.',
  'task-version-conflict': 'Nhiệm vụ đã thay đổi trên thiết bị khác. Hãy mở lại để xem bản mới.',
  'subject-not-found': 'Môn học đã được xóa trên thiết bị khác.',
  'too-many-tasks': 'Có quá nhiều nhiệm vụ để cập nhật trong một lần.',
  'task-not-found': 'Nhiệm vụ đã bị xóa hoặc không còn tồn tại.',
  'invalid-task-fields': 'Hãy kiểm tra lại ngày, tên và thời lượng nhiệm vụ.',
  'undo-insufficient-funds': 'Số dư hiện tại chưa đủ để hoàn lại xu của nhiệm vụ này.',
  'active-session-exists': 'Đang có một phiên tập trung trên tài khoản này.',
  'focus-version-conflict': 'Phiên tập trung đã thay đổi trên thiết bị khác.',
  'session-expired': 'Phiên tập trung đã hết hạn. Hãy bắt đầu phiên mới.',
  'session-not-active': 'Phiên tập trung đã kết thúc trên thiết bị khác.',
  'not-found': 'Máy chủ ví chưa sẵn sàng.',
};
const temporaryStatus = new Set([502, 503, 504]);

export async function sendWalletCommand(actorUid, command) {
  const user = getCurrentUser();
  const ensureAccount = () => {
    if (!user || user.uid !== actorUid || getCurrentUser() !== user) {
      throw new Error('Tài khoản đăng nhập đã thay đổi. Hãy mở lại thao tác.');
    }
  };
  ensureAccount();
  if (!command?.operationId) throw new Error('Thiếu mã thao tác ví.');
  const body = JSON.stringify(command);

  for (let attempt = 0; attempt < 2; attempt++) {
    ensureAccount();
    const token = await user.getIdToken();
    ensureAccount();

    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      ensureAccount();
      if (attempt === 0) continue;
      throw new Error('Không nhận được phản hồi từ máy chủ ví. Hãy thử lại yêu cầu hiện tại.');
    }
    ensureAccount();
    if (temporaryStatus.has(response.status) && attempt === 0) continue;

    const data = await response.json().catch(() => null);
    ensureAccount();
    if (response.ok && data?.ok === true && data.result) return data.result;
    const code = data?.error || (response.status === 401 ? 'unauthenticated' : 'unknown');
    throw Object.assign(new Error(messages[code] || 'Máy chủ ví chưa xác nhận thao tác. Hãy thử lại yêu cầu hiện tại.'), { code });
  }
}
