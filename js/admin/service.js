import { collection, doc, getDocs, getDocFromServer, query, where, orderBy, documentId, limit, startAfter, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, requireAdmin, OWNER_UID } from '../cloud.js';
import { applyAdminCredits } from '../sync.js';
import { coinChange, validateReason, canChangeAccess } from './policy.js';

export const PAGE_SIZE = 20;
export function userRow(snapshot) {
  const data = snapshot.data();
  const state = applyAdminCredits(data.state || {}, data.adminCredits || 0);
  return { uid: snapshot.id, displayName: data.displayName || data.state?.settings?.userName || 'Chưa có tên', email: data.email || '', photoURL: data.photoURL || '', publicId: data.publicId || '', coins: state.wallet?.coins || 0, role: snapshot.id === OWNER_UID || data.role === 'admin' ? 'admin' : 'member', status: data.status === 'banned' ? 'banned' : 'active', owner: snapshot.id === OWNER_UID || data.owner === true };
}
export async function listUsers({ cursor = null, search = '' } = {}) {
  if (!await requireAdmin()) throw new Error('Bạn không có quyền quản trị.');
  const db = firebaseDb();
  const users = collection(db, 'users');
  const term = search.trim();
  if (term) {
    if (term.includes('@') || /^GHN-/i.test(term)) {
      const field = term.includes('@') ? 'emailLower' : 'publicId';
      const value = field === 'emailLower' ? term.toLowerCase() : term.toUpperCase();
      let snap = await getDocs(query(users, where(field, '==', value), limit(PAGE_SIZE)));
      if (snap.empty && field === 'emailLower') snap = await getDocs(query(users, where('email', '==', term), limit(PAGE_SIZE)));
      return { rows: snap.docs.map(userRow), cursor: null, hasMore: false };
    }
    if (term.includes('/')) throw new Error('UID không hợp lệ.');
    const snap = await getDocFromServer(doc(db, 'users', term));
    return { rows: snap.exists() ? [userRow(snap)] : [], cursor: null, hasMore: false };
  }
  const parts = [orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(PAGE_SIZE + 1)];
  const snap = await getDocs(query(users, ...parts));
  const page = snap.docs.slice(0, PAGE_SIZE);
  return { rows: page.map(userRow), cursor: page.at(-1) || null, hasMore: snap.docs.length > PAGE_SIZE };
}
export async function resolveUser(term) {
  const result = await listUsers({ search: term });
  if (result.rows.length !== 1) throw new Error(result.rows.length ? 'Email trùng nhiều tài khoản. Hãy dùng UID.' : 'Không tìm thấy người dùng.');
  return result.rows[0];
}

/** All privileged changes and their append-only audit entry commit atomically. */
export async function changeUser({ uid, type, value, reason, operationId }) {
  const actor = await requireAdmin();
  if (!actor) throw new Error('Bạn không có quyền quản trị.');
  reason = validateReason(reason);
  if (!uid || uid.includes('/') || !/^[a-zA-Z0-9-]{16,80}$/.test(operationId || '')) throw new Error('Mã thao tác không hợp lệ.');
  const db = firebaseDb();
  const ref = doc(db, 'users', uid);
  const log = doc(db, 'adminLogs', operationId);
  return runTransaction(db, async tx => {
    const existingLog = await tx.get(log);
    if (existingLog.exists()) {
      const prior = existingLog.data();
      if (prior.actorUid !== actor.uid || prior.targetUid !== uid || prior.type !== type || prior.requestedValue !== value || prior.reason !== reason) throw new Error('Mã thao tác đã được sử dụng cho yêu cầu khác.');
      return prior;
    }
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Tài khoản không còn tồn tại.');
    const target = snap.data();
    const patch = { updatedAt: serverTimestamp(), lastAdminOperation: operationId };
    let before, after;
    if (type === 'coins-add' || type === 'coins-set') {
      const balance = applyAdminCredits(target.state || {}, target.adminCredits || 0).wallet?.coins || 0;
      const change = coinChange(balance, value, type === 'coins-add' ? 'add' : 'set');
      before = change.before; after = change.after;
      patch.adminCredits = (target.adminCredits || 0) + change.delta;
    } else {
      if (!canChangeAccess(actor.uid, uid, { ...target, owner: uid === OWNER_UID || target.owner === true })) throw new Error('Không thể đổi quyền hoặc khóa tài khoản này.');
      if (type === 'status' && ['active', 'banned'].includes(value)) {
        before = target.status || 'active'; after = value;
        patch.status = value; patch.banReason = value === 'banned' ? reason : '';
        patch.bannedAt = value === 'banned' ? serverTimestamp() : null;
        patch.bannedBy = value === 'banned' ? actor.uid : null;
      } else if (type === 'role' && ['admin', 'member'].includes(value)) {
        before = target.role || 'member'; after = value; patch.role = value;
      } else throw new Error('Thao tác không hợp lệ.');
    }
    const entry = { actorUid: actor.uid, actorEmail: actor.email || '', targetUid: uid, type, requestedValue: value, before, after, reason, createdAt: serverTimestamp() };
    tx.update(ref, patch);
    tx.set(log, entry);
    return entry;
  });
}
export async function listActivity() {
  if (!await requireAdmin()) throw new Error('Bạn không có quyền quản trị.');
  const snap = await getDocs(query(collection(firebaseDb(), 'adminLogs'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function adminError(error) {
  const code = error?.code || '';
  if (code.includes('permission-denied')) return 'Firestore chưa cấp quyền. Cần áp dụng firestore.rules và kiểm tra role của tài khoản.';
  if (code.includes('unavailable')) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return error?.message || 'Không thực hiện được thao tác.';
}
