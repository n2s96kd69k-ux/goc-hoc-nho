// One short-lived record per browser page, counted once per authenticated account.
import { collection, doc, query, where, onSnapshot, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseDb, onCloudAuthChange } from './cloud.js';
import { getTimer, onTimer } from './timer.js';
export function countStudying(rows, now = Date.now()) {
  return new Set(rows.filter(r => typeof r.uid === 'string' && r.expiresAt?.toMillis() > now && r.focusEndsAt?.toMillis() > now).map(r => r.uid)).size;
}
export function startStudyPresence(onCount) {
  const db = firebaseDb(); if (!db) { onCount(null); return () => {}; }
  const pageId = crypto.randomUUID();
  let user = null, rows = [], connected = false, stopped = false, suspended = false, generation = 0;
  let queue = Promise.resolve();
  const publish = () => onCount(connected ? countStudying(rows) : null);
  const refFor = uid => doc(db, 'studyPresence', `${uid}_${pageId}`);
  const remove = uid => { if (uid) return deleteDoc(refFor(uid)).catch(e => console.warn('Không gỡ được trạng thái học:', e.code)); };
  function sync() {
    const uid = user?.uid, version = generation;
    const timer = getTimer();
    const running = timer.status === 'running' && timer.mode === 'focus' && timer.endAt > Date.now();
    const endAt = timer.endAt;
    // Serialize start/stop so a slow start request cannot overwrite a later stop.
    queue = queue.catch(() => {}).then(async () => {
      if (stopped || suspended || version !== generation || !uid) return;
      if (!running) { await remove(uid); return; }
      try {
        await setDoc(refFor(uid), { uid, updatedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 90000), focusEndsAt: Timestamp.fromMillis(endAt) });
        // A write already in flight may finish after logout/pagehide/cleanup.
        if (stopped || suspended || version !== generation) await remove(uid);
      } catch (error) { console.warn('Không đồng bộ được trạng thái học:', error.code); }
    });
  }
  const stopAuth = onCloudAuthChange(next => {
    const previous = user?.uid; generation++; user = next;
    if (previous && previous !== next?.uid) remove(previous);
    sync();
  });
  const stopTimer = onTimer((timer, event) => { if (event !== 'tick') sync(); });
  const stopFeed = onSnapshot(query(collection(db, 'studyPresence'), where('expiresAt', '>', Timestamp.now())), { includeMetadataChanges: true }, snap => {
    rows = snap.docs.map(d => d.data()); connected = !snap.metadata.fromCache; publish();
  }, error => { connected = false; publish(); console.warn('Không tải được số người đang học:', error.code); });
  const heartbeat = setInterval(sync, 30000);
  const expiry = setInterval(publish, 5000);
  const reconnect = () => sync();
  const leave = () => { suspended = true; generation++; remove(user?.uid); };
  const resume = () => { suspended = false; sync(); };
  window.addEventListener('online', reconnect);
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', resume);
  const visible = () => { if (document.visibilityState === 'visible') sync(); };
  document.addEventListener('visibilitychange', visible);
  return () => {
    stopped = true; generation++; stopAuth(); stopTimer(); stopFeed(); clearInterval(heartbeat); clearInterval(expiry);
    window.removeEventListener('online', reconnect); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', resume); document.removeEventListener('visibilitychange', visible); leave();
  };
}
