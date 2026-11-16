import { collection, doc, query, orderBy, limit, getDocs, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, requireAdmin } from '../cloud.js';
export async function listAnnouncements() {
  if (!await requireAdmin()) throw new Error('Bạn không có quyền quản trị.');
  const snap = await getDocs(query(collection(firebaseDb(), 'announcements'), orderBy('createdAt', 'desc'), limit(30)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function publishAnnouncement(id, content) {
  content = String(content || '').trim();
  if (!content || content.length > 1000) throw new Error('Nội dung cần từ 1 đến 1.000 ký tự.');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('Mã thông báo không hợp lệ.');
  const actor = await requireAdmin();
  if (!actor) throw new Error('Bạn không có quyền quản trị.');
  await setDoc(doc(firebaseDb(), 'announcements', id), { type: 'global_banner', content, createdAt: serverTimestamp(), createdBy: actor.uid });
}
export async function deleteAnnouncement(id) {
  if (!await requireAdmin()) throw new Error('Bạn không có quyền quản trị.');
  if (!id || id.includes('/')) throw new Error('Mã thông báo không hợp lệ.');
  await deleteDoc(doc(firebaseDb(), 'announcements', id));
}
