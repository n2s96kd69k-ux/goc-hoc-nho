// ===== Logic nhiệm vụ =====
import { getState, update, dayRecord } from './state.js';
import { uid, pct } from './utils.js';
import { addCoins, REWARDS, recomputeStreak, checkWeekComplete } from './gamification.js';
import { sounds } from './sounds.js';
import { mascot } from './mascot.js';

export function tasksOfDay(key) {
  return getState().tasks
    .filter((t) => t.date === key)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.createdAt || 0) - (b.createdAt || 0));
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
    dayRecord(t.date);
  }, { type: 'task-toggle', id, done: nowDone });

  let coins = 0;
  let dayComplete = false;
  let weekBonus = 0;
  if (nowDone) {
    coins += REWARDS.TASK;
    const after = dayProgress(t.date);
    if (after.total > 0 && after.done === after.total && before.done !== before.total) {
      coins += REWARDS.DAY_COMPLETE;
      dayComplete = true;
    }
    addCoins(coins, 'task');
    weekBonus = checkWeekComplete(t.date);
    if (dayComplete) { sounds.fanfare(); mascot.react('celebrate'); }
    else { sounds.pop(); mascot.react('happy'); }
  } else {
    coins -= REWARDS.TASK;
    const after = dayProgress(t.date);
    if (before.total > 0 && before.done === before.total && after.done !== after.total) {
      coins -= REWARDS.DAY_COMPLETE;
    }
    addCoins(coins, 'task-undo');
  }
  const { events } = recomputeStreak();
  return { done: nowDone, coins, dayComplete, weekBonus, streakEvents: events };
}

export function moveTask(id, newDate) {
  updateTask(id, { date: newDate });
}

export function getTask(id) { return getState().tasks.find((t) => t.id === id); }
