// ===== Đồng hồ Pomodoro (chạy nền, độc lập với trang đang mở) =====
import { getState, update, dayRecord } from './state.js';
import { todayKey } from './utils.js';
import { addCoins, pomodoroReward, recomputeStreak } from './gamification.js';
import { sounds } from './sounds.js';
import { mascot } from './mascot.js';

const listeners = new Set();

const timer = {
  mode: 'focus',        // 'focus' | 'break'
  status: 'idle',       // 'idle' | 'running' | 'paused'
  remaining: 25 * 60,   // giây
  duration: 25 * 60,
  endAt: null,          // timestamp kết thúc (dùng Date để chính xác khi tab ẩn)
  taskId: null,
  subjectId: null,
  interval: null,
};

export function getTimer() { return timer; }

export function onTimer(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(evt = 'tick') { for (const fn of listeners) fn(timer, evt); }

export function setupDurations() {
  const s = getState().settings;
  if (timer.status === 'idle') {
    timer.duration = (timer.mode === 'focus' ? s.focusMinutes : s.breakMinutes) * 60;
    timer.remaining = timer.duration;
    emit('reset');
  }
}

export function setPreset(focus, brk) {
  update((s) => { s.settings.focusMinutes = focus; s.settings.breakMinutes = brk; }, { type: 'settings' });
  timer.mode = 'focus';
  timer.status = 'idle';
  clearInterval(timer.interval);
  setupDurations();
}

export function setMode(mode) {
  if (timer.status === 'running') return;
  timer.mode = mode;
  timer.status = 'idle';
  setupDurations();
}

export function attachTask(taskId, subjectId) {
  timer.taskId = taskId || null;
  timer.subjectId = subjectId || null;
  emit('task');
}

export function start() {
  if (timer.status === 'running') return;
  if (timer.status === 'idle') setupDurations();
  timer.endAt = Date.now() + timer.remaining * 1000;
  timer.status = 'running';
  clearInterval(timer.interval);
  timer.interval = setInterval(tick, 250);
  if (timer.mode === 'focus') mascot.setState('focus'); else mascot.setState('rest');
  emit('start');
}

export function pause() {
  if (timer.status !== 'running') return;
  timer.remaining = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  timer.status = 'paused';
  clearInterval(timer.interval);
  mascot.setState('idle');
  emit('pause');
}

export function reset() {
  clearInterval(timer.interval);
  timer.status = 'idle';
  setupDurations();
  mascot.setState('idle');
  emit('reset');
}

function tick() {
  const left = Math.max(0, Math.round((timer.endAt - Date.now()) / 1000));
  if (left !== timer.remaining) {
    timer.remaining = left;
    emit('tick');
  }
  if (left <= 0) complete();
}

function complete() {
  clearInterval(timer.interval);
  timer.status = 'idle';
  const finishedMode = timer.mode;
  const minutes = Math.round(timer.duration / 60);

  if (finishedMode === 'focus') {
    const key = todayKey();
    update((s) => {
      const d = dayRecord(key);
      d.minutes += minutes;
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
    const coins = pomodoroReward(minutes);
    addCoins(coins, 'pomodoro');
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
  emit('complete:' + finishedMode);
  document.dispatchEvent(new CustomEvent('pomodoro:complete', { detail: { mode: finishedMode, minutes, coins: timer.lastReward || 0 } }));
}

/** Ghi nhận thời gian học thủ công */
export function logManualMinutes(minutes, key = todayKey()) {
  update((s) => {
    const d = dayRecord(key);
    d.minutes += minutes;
    s.timer.totalFocusMinutes = (s.timer.totalFocusMinutes || 0) + minutes;
  }, { type: 'minutes' });
  recomputeStreak();
}
