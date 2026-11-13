// ===== Logic nhiệm vụ =====
import { getState, update, dayRecord } from './state.js';
import { uid, pct, todayKey } from './utils.js';
import { addCoins, REWARDS, recomputeStreak, checkWeekComplete } from './gamification.js';
import { sounds } from './sounds.js';
import { mascot } from './mascot.js';

export function tasksOfDay(key) {
  const list = getState().tasks.filter((t) => t.date === key);
  const ranked = list.some((t) => typeof t.order === 'number');
  if (!ranked) return list.sort((a, b) => Number(a.done) - Number(b.done) || (a.createdAt || 0) - (b.createdAt || 0));
  return list.sort((a, b) => (a.order ?? 1e15) - (b.order ?? 1e15));
}

export function tasksOfWeek(keys) {
  const set = new Set(keys);
  return getState().tasks.filter((t) => set.has(t.date));
}

export function dayProgress(key) {
  const list = tasksOfDay(key);
  const done = list.filter((t) => t.done).length;
  return { total: list.length, done, percent: pct(done, list.length) };
}

/** Môn chính của ngày: môn có nhiều task nhất */
export function mainSubjectOfDay(key) {
  const list = tasksOfDay(key);
  if (!list.length) return null;
  const count = {};
  for (const t of list) count[t.subjectId] = (count[t.subjectId] || 0) + 1;
  const id = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];
  return getState().subjects.find((s) => s.id === id) || null;
}

export function applyFilter(list, filter) {
  if (!filter || filter === 'all') return list;
  if (filter === 'done') return list.filter((t) => t.done);
  if (filter === 'todo') return list.filter((t) => !t.done);
  return list.filter((t) => t.subjectId === filter);
}

export function addTask(data) {
  const task = {
    id: uid(),
    title: (data.title || '').trim() || 'Nhiệm vụ mới',
    subjectId: data.subjectId || (getState().subjects[0] && getState().subjects[0].id) || null,
    date: data.date,
    minutes: Number(data.minutes) || 30,
    pomodoros: Number(data.pomodoros) || 1,
    priority: data.priority || 'medium',
    note: data.note || '',
    done: false,
    createdAt: Date.now(),
    completedAt: null,
  };
  update((s) => { s.tasks.push(task); }, { type: 'task-add', task });
  return task;
}

export function updateTask(id, patch) {
  update((s) => {
    const t = s.tasks.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
  }, { type: 'task-update', id });
}

export function deleteTask(id) {
  update((s) => { s.tasks = s.tasks.filter((t) => t.id !== id); }, { type: 'task-delete', id });
}

/**
 * Bật/tắt hoàn thành. Trả về thông tin phần thưởng để UI hiển thị.
 * @returns {{done:boolean, coins:number, dayComplete:boolean, streakEvents:Array}}
 */
export function toggleTask(id) {
  const s = getState();
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return null;
  const nowDone = !t.done;
  const before = dayProgress(t.date);

  update((st) => {
    const task = st.tasks.find((x) => x.id === id);
    task.done = nowDone;
    task.completedAt = nowDone ? Date.now() : null;
    // Đảm bảo bản ghi ngày tồn tại (để lịch tháng có màu)
    dayRecord(t.date);
  }, { type: 'task-toggle', id, done: nowDone });

  let coins = 0;
  let dayComplete = false;
  let weekBonus = 0;
  if (nowDone) {
    update((st) => {
      const rec = dayRecord(t.date);
      const earned = rec.taskCoins || 0;
      coins = Math.min(REWARDS.TASK, Math.max(0, REWARDS.TASK_DAY_CAP - earned));
      const task = st.tasks.find((x) => x.id === id);
      if (task) task.coinGain = coins;
      rec.taskCoins = earned + coins;
    }, { type: 'task-toggle', id, done: nowDone });
    const after = dayProgress(t.date);
    dayComplete = after.total > 0 && after.done === after.total && before.done !== before.total;
    if (coins) addCoins(coins, 'task');
    weekBonus = checkWeekComplete(t.date);
    if (dayComplete) { sounds.fanfare(); mascot.react('celebrate'); }
    else { sounds.pop(); mascot.react('happy'); }
  } else {
    coins = -(t.coinGain || 0);
    update((st) => {
      const task = st.tasks.find((x) => x.id === id);
      const rec = dayRecord(t.date);
      const back = task && task.coinGain ? task.coinGain : 0;
      if (task) task.coinGain = 0;
      rec.taskCoins = Math.max(0, (rec.taskCoins || 0) - back);
    }, { type: 'task-toggle', id, done: nowDone });
    if (coins) addCoins(coins, 'task-undo');
  }
  const { events } = recomputeStreak();
  return { done: nowDone, coins, dayComplete, weekBonus, streakEvents: events };
}

/** Chuyển task sang ngày khác */
export function moveTask(id, newDate) {
  updateTask(id, { date: newDate });
}

/** Đặt task vào ngày mới, chèn trước beforeId. Xong việc kéo sang tương lai thì bỏ đánh dấu. */
export function placeTask(id, date, beforeId) {
  const current = getState().tasks.find((t) => t.id === id);
  if (!current) return null;
  const prev = { date: current.date, order: current.order, done: current.done, completedAt: current.completedAt };
  const reset = !!current.done && date > todayKey();
  update((st) => {
    const task = st.tasks.find((t) => t.id === id);
    if (!task) return;
    const others = st.tasks
      .filter((t) => t.date === date && t.id !== id)
      .sort((a, b) => (typeof a.order === 'number' ? a.order : a.createdAt || 0) - (typeof b.order === 'number' ? b.order : b.createdAt || 0));
    let index = beforeId ? others.findIndex((t) => t.id === beforeId) : others.length;
    if (index < 0) index = others.length;
    others.splice(index, 0, task);
    task.date = date;
    if (reset) {
      task.done = false;
      task.completedAt = null;
    }
    others.forEach((t, i) => { t.order = i; });
  }, { type: 'task-move', id });
  return { prev, reset };
}

export function restoreTask(id, prev) {
  update((st) => {
    const task = st.tasks.find((t) => t.id === id);
    if (task) Object.assign(task, prev);
  }, { type: 'task-move', id, rollback: true });
}

export function getTask(id) { return getState().tasks.find((t) => t.id === id); }
