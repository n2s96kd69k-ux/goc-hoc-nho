// ===== Đồng hồ Pomodoro (chạy nền, độc lập với trang đang mở) =====
import { getState, update, dayRecord, subscribe } from './state.js';
import { todayKey } from './utils.js';
import { pomodoroReward, recomputeStreak } from './gamification.js';
import { sounds } from './sounds.js';
import { mascot } from './mascot.js';
import { getCurrentUser } from './cloud.js';
import { walletMode } from './wallet-account.js';
import { focusSession, sendFocus, startFocusAccount, subscribeFocus } from './focus-account.js';

const listeners = new Set();
let accountUser;
let accountMode;
let serverId;
let inFlight;
let retryAt = 0;
let context = 0;

const timer = {
  mode: 'focus',        // 'focus' | 'break'
  status: 'idle',       // 'idle' | 'running' | 'paused'
  remaining: 25 * 60,   // giây
  duration: 25 * 60,
  endAt: null,          // timestamp kết thúc (dùng Date để chính xác khi tab ẩn)
  taskId: null,
  subjectId: null,
  sessionId: null,
  sessionDate: null,
  interval: null,
};

export function getTimer() { return timer; }

export function onTimer(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function sessionSnapshot() {
  const { interval, ...session } = timer;
  return session;
}
function emit(evt = 'tick') {
  if (evt !== 'tick' && walletMode() === 'legacy' && (!getState()._syncUid || getState()._syncUid === getCurrentUser()?.uid)) update(s => { s.timer.session = sessionSnapshot(); }, { silent: true, type: 'timer-session' });
  for (const fn of listeners) fn(timer, evt);
}

/** Restore from the same persisted state as study totals and rewards. */
export function restoreTimer() {
  if (walletMode() !== 'legacy') {
    setupDurations();
    return;
  }
  clearInterval(timer.interval);
  const saved = getState().timer.session;
  const owner = getState()._syncUid;
  const valid = (!owner || owner === getCurrentUser()?.uid) && saved && ['focus', 'break'].includes(saved.mode)
    && ['running', 'paused', 'idle'].includes(saved.status)
    && Number.isFinite(saved.duration) && saved.duration > 0
    && Number.isFinite(saved.remaining) && saved.remaining >= 0
    && (saved.status !== 'running' || Number.isFinite(saved.endAt));
  if (!valid) {
    Object.assign(timer, { status: 'idle', mode: 'focus', taskId: null, subjectId: null, sessionId: null, endAt: null });
    setupDurations();
    return;
  }
  for (const key of ['mode', 'status', 'duration', 'remaining', 'endAt', 'taskId', 'subjectId', 'sessionId', 'sessionDate']) timer[key] = saved[key];
  if (timer.status === 'running') {
    timer.sessionId ||= `legacy-${timer.endAt}-${timer.duration}`;
    timer.sessionDate ||= todayKey();
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    if (timer.remaining === 0) { complete(); return; }
    timer.interval = setInterval(tick, 250);
    mascot.setState(timer.mode === 'focus' ? 'focus' : 'rest');
  } else mascot.setState('idle');
  document.dispatchEvent(new CustomEvent('study:presence', { detail: { on: timer.status === 'running' && timer.mode === 'focus' } }));
  emit('restore');
}
subscribe((s, meta) => { if (meta.type === 'replace') restoreTimer(); });

export function startTimerAccount() {
  subscribeFocus(session => {
    const user = getCurrentUser();
    const mode = walletMode();
    if (user !== accountUser || mode !== accountMode) {
      accountUser = user;
      accountMode = mode;
      context++;
      inFlight = null;
      serverId = null;
      retryAt = 0;
      clearInterval(timer.interval);
      Object.assign(timer, { status: 'idle', mode: 'focus', taskId: null, subjectId: null,
        sessionId: null, sessionDate: null, endAt: null, pending: false, error: '' });
      if (mode === 'legacy') {
        restoreTimer();
        return;
      }
      mascot.setState('idle');
      setupDurations();
    }
    if (mode !== 'server') return;
    if (!session || session.expiresAt <= Date.now()) {
      if (session === undefined && serverId) return;
      if (serverId) {
        serverId = null;
        clearInterval(timer.interval);
        Object.assign(timer, { status: 'idle', sessionId: null, endAt: null });
        mascot.setState('idle');
        setupDurations();
      }
      emit('server-session');
      return;
    }
    if (serverId !== session.id) retryAt = 0;
    serverId = session.id;
    const remainingMs = Math.max(0, session.durationMs - session.elapsedMs);
    const endAt = session.status === 'running' ? session.resumedAt + remainingMs : null;
    clearInterval(timer.interval);
    Object.assign(timer, {
      status: session.status, mode: 'focus', sessionId: session.id, sessionDate: session.date,
      taskId: session.taskId ?? null, subjectId: session.subjectId ?? null, endAt,
      duration: session.durationMs / 1000,
      remaining: Math.max(0, Math.ceil((endAt === null ? remainingMs : endAt - Date.now()) / 1000)),
    });
    mascot.setState(session.status === 'running' ? 'focus' : 'idle');
    if (session.status === 'running') timer.interval = setInterval(tick, 250);
    emit('server-session');
  });
  startFocusAccount();
}

export function timerControlsReady() {
  const mode = walletMode();
  return mode === 'legacy' || (mode === 'server' && focusSession() !== undefined);
}

async function runFocus(type, options) {
  if (inFlight) return;
  const owner = context;
  inFlight = type;
  timer.pending = true;
  timer.error = '';
  emit('server-command');
  try {
    const result = await sendFocus(type, options);
    if (owner !== context || walletMode() !== 'server') return;
    if (result.status === 'completed') {
      if (serverId === options.sessionId || !serverId) {
        serverId = null;
        clearInterval(timer.interval);
        Object.assign(timer, { status: 'idle', mode: 'break', sessionId: null, endAt: null });
        setupDurations();
      }
      sounds.ting();
      mascot.react('celebrate');
      document.dispatchEvent(new CustomEvent('pomodoro:complete', { detail: {
        mode: 'focus', minutes: result.reward, coins: result.reward, streakEvents: result.streak?.events || [],
      } }));
    }
  } catch (error) {
    if (owner !== context) return;
    retryAt = Date.now() + (error.code === 'focus-too-early' ? 3000 : 15000);
    if (error.code !== 'focus-too-early') timer.error = error.message;
    if (type === 'focus-complete' && error.code === 'session-expired') {
      serverId = null;
      clearInterval(timer.interval);
      Object.assign(timer, { status: 'idle', sessionId: null, endAt: null });
      setupDurations();
    }
  } finally {
    if (owner === context) {
      inFlight = null;
      timer.pending = false;
      emit('server-command');
    }
  }
}

function activeFocusOptions(session) {
  return { sessionId: session.id, expectedRevision: session.revision ?? 0 };
}

export function setupDurations() {
  const s = getState().settings;
  if (timer.status === 'idle') {
    timer.duration = (timer.mode === 'focus' ? s.focusMinutes : s.breakMinutes) * 60;
    timer.remaining = timer.duration;
    emit('reset');
  }
}

export function setPreset(focus, brk) {
  if (walletMode() !== 'legacy' && (timer.pending || serverId)) return;
  update((s) => { s.settings.focusMinutes = focus; s.settings.breakMinutes = brk; }, { type: 'settings' });
  timer.mode = 'focus';
  timer.status = 'idle';
  clearInterval(timer.interval);
  setupDurations();
}

export function setMode(mode) {
  if (timer.status === 'running' || (walletMode() !== 'legacy' && (timer.pending || serverId))) return;
  timer.mode = mode;
  timer.status = 'idle';
  setupDurations();
}

export function attachTask(taskId, subjectId) {
  if (walletMode() !== 'legacy' && (timer.pending || serverId)) return;
  timer.taskId = taskId || null;
  timer.subjectId = subjectId || null;
  emit('task');
}

export function start() {
  if (timer.status === 'running' || !timerControlsReady()) return;
  if (walletMode() === 'server' && timer.mode === 'focus') {
    const session = focusSession();
    if (session && session.expiresAt > Date.now()) {
      if (session.status === 'paused') return runFocus('focus-resume', activeFocusOptions(session));
      return;
    }
    return runFocus('focus-start', {
      minutes: getState().settings.focusMinutes, taskId: timer.taskId, subjectId: timer.subjectId,
    });
  }
  if (timer.status === 'idle') {
    setupDurations();
    timer.sessionId = globalThis.crypto.randomUUID();
    timer.sessionDate = todayKey();
  }
  timer.endAt = Date.now() + timer.remaining * 1000;
  timer.status = 'running';
  clearInterval(timer.interval);
  timer.interval = setInterval(tick, 250);
  if (timer.mode === 'focus') mascot.setState('focus'); else mascot.setState('rest');
  document.dispatchEvent(new CustomEvent('study:presence', { detail: { on: timer.mode === 'focus' } }));
  emit('start');
}

export function pause() {
  if (timer.status !== 'running' || !timerControlsReady()) return;
  if (walletMode() === 'server' && timer.mode === 'focus') {
    const session = focusSession();
    if (session?.status === 'running') return runFocus('focus-pause', activeFocusOptions(session));
    return;
  }
  timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  timer.status = 'paused';
  clearInterval(timer.interval);
  mascot.setState('idle');
  document.dispatchEvent(new CustomEvent('study:presence', { detail: { on: false } }));
  emit('pause');
}

export function reset() {
  if (!timerControlsReady()) return;
  if (walletMode() === 'server' && serverId) {
    const session = focusSession();
    if (session) return runFocus('focus-cancel', activeFocusOptions(session));
    return;
  }
  clearInterval(timer.interval);
  timer.status = 'idle';
  setupDurations();
  mascot.setState('idle');
  document.dispatchEvent(new CustomEvent('study:presence', { detail: { on: false } }));
  emit('reset');
}

function tick() {
  const left = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
  if (left !== timer.remaining) {
    timer.remaining = left;
    emit('tick');
  }
  if (left > 0) return;
  if (walletMode() === 'server' && timer.mode === 'focus') {
    const session = focusSession();
    if (session?.id === serverId && !inFlight && Date.now() >= retryAt) {
      return runFocus('focus-complete', { sessionId: session.id });
    }
    return;
  }
  if (walletMode() !== 'unavailable') complete();
}

function complete() {
  if (timer.mode === 'focus' && walletMode() !== 'legacy') return;
  clearInterval(timer.interval);
  timer.status = 'idle';
  const finishedMode = timer.mode;
  const minutes = Math.round(timer.duration / 60);
  const coins = finishedMode === 'focus' ? pomodoroReward(minutes) : 0;
  if (timer.sessionId && (getState().timer.lastCompletedSession === timer.sessionId || getState().studyEvents?.[timer.sessionId])) {
    timer.mode = finishedMode === 'focus' ? 'break' : 'focus';
    setupDurations();
    return;
  }

  if (finishedMode === 'focus') {
    const key = timer.sessionDate || todayKey();
    update((s) => {
      s.studyEvents ||= {};
      s.studyEvents[timer.sessionId] = { type: 'focus', minutes, date: key, subjectId: timer.subjectId || null };
      s.timer.lastCompletedSession = timer.sessionId;
      s.timer.session = { ...sessionSnapshot(), mode: 'break', status: 'idle' };
      s.wallet.coins = (s.wallet.coins || 0) + coins;
      s.wallet.totalEarned = (s.wallet.totalEarned || 0) + coins;
      const d = dayRecord(key);
      if (typeof d.pomoMinutes !== 'number') d.pomoMinutes = d.pomodoros ? (d.minutes || 0) : 0;
      d.minutes += minutes;
      d.pomoMinutes += minutes;
      d.pomodoros += 1;
      s.timer.totalFocusMinutes = (s.timer.totalFocusMinutes || 0) + minutes;
      s.timer.totalPomodoros = (s.timer.totalPomodoros || 0) + 1;
      if (timer.subjectId) {
        s.timer.bySubject = s.timer.bySubject || {};
        s.timer.pomosBySubject = s.timer.pomosBySubject || {};
        s.timer.bySubject[timer.subjectId] = (s.timer.bySubject[timer.subjectId] || 0) + minutes;
        s.timer.pomosBySubject[timer.subjectId] = (s.timer.pomosBySubject[timer.subjectId] || 0) + 1;
      }
    }, { type: 'pomodoro-complete', minutes });
    recomputeStreak();
    sounds.ting();
    mascot.react('celebrate');
    timer.mode = 'break';
    timer.lastReward = coins;
  } else {
    timer.mode = 'focus';
    mascot.setState('idle');
  }
  setupDurations();
  document.dispatchEvent(new CustomEvent('study:presence', { detail: { on: false } }));
  emit('complete:' + finishedMode);
  document.dispatchEvent(new CustomEvent('pomodoro:complete', { detail: { mode: finishedMode, minutes, coins: timer.lastReward || 0 } }));
}

/** Ghi nhận thời gian học thủ công */
export function logManualMinutes(minutes, key = todayKey()) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('Thời gian học phải từ 1 đến 1440 phút.');
  const eventId = globalThis.crypto.randomUUID();
  update((s) => {
    s.studyEvents ||= {};
    s.studyEvents[eventId] = { type: 'manual', minutes, date: key };
    const d = dayRecord(key);
    d.minutes += minutes;
    s.timer.totalFocusMinutes = (s.timer.totalFocusMinutes || 0) + minutes;
  }, { type: 'minutes' });
  recomputeStreak();
}
