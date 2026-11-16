import { collection, query, orderBy, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, onCloudAuthChange } from '../cloud.js';
import { selectAccount, receiveNotifications } from './store.js';
export function startNotifications() {
  let stops = [], generation = 0;
  return onCloudAuthChange(user => {
    const run = ++generation; stops.forEach(stop => stop()); stops = []; selectAccount(user?.uid);
    const db = firebaseDb(); if (!db) return;
    const watch = (ref, prefix, type) => stops.push(onSnapshot(query(ref, orderBy('createdAt','desc'), limit(50)), snap => {
      if (run !== generation) return;
      receiveNotifications(snap.docs.map(d => ({ id: prefix + d.id, type, content: d.data().content, createdAt: d.data().createdAt?.toMillis?.() || 0 })));
    }, error => console.warn('Không tải được thông báo:', error.code)));
    watch(collection(db,'announcements'),'global:','global_banner');
    if (user) watch(collection(db,'users',user.uid,'notifications'),'personal:','personal');
  });
}
