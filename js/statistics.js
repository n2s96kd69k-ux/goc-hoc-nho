// ===== Thống kê =====
import { getState } from './state.js';
import { weekKeys, startOfWeek, todayKey, toKey, addDays, pct } from './utils.js';
import { subjectStats } from './subjects.js';

/** Phút học trong ngày = phút từ Pomodoro/ghi tay + phút dự kiến của task đã hoàn thành */
export function minutesOfDay(key) {
  const s = getState();
  const d = s.days[key];
  const fromTimer = d ? d.minutes || 0 : 0;
  const fromTasks = s.tasks.filter((t) => t.date === key && t.done).reduce((a, t) => a + (t.minutes || 0), 0);
  return fromTimer + fromTasks;
}

export function pomodorosOfDay(key) {
  const s = getState();
  const d = s.days[key];
  const fromTimer = d ? d.pomodoros || 0 : 0;
  const fromTasks = s.tasks.filter((t) => t.date === key && t.done).reduce((a, t) => a + (t.pomodoros || 0), 0);
  return fromTimer + fromTasks;
}

export function weekSummary(monday = startOfWeek(todayKey())) {
  const keys = weekKeys(monday);
  const s = getState();
  const perDay = keys.map((k) => {
    const list = s.tasks.filter((t) => t.date === k);
    const done = list.filter((t) => t.done).length;
    return { key: k, total: list.length, done, percent: pct(done, list.length), minutes: minutesOfDay(k), pomodoros: pomodorosOfDay(k) };
  });
  const total = perDay.reduce((a, d) => a + d.total, 0);
  const done = perDay.reduce((a, d) => a + d.done, 0);
  const minutes = perDay.reduce((a, d) => a + d.minutes, 0);
  const pomodoros = perDay.reduce((a, d) => a + d.pomodoros, 0);
  return { keys, perDay, total, done, percent: pct(done, total), minutes, pomodoros };
}

/** Tổng phút học mọi thời gian (dùng cho cây tiến độ) */
export function totalMinutesAllTime() {
  const s = getState();
  const days = Object.keys(s.days);
  const taskDays = new Set(s.tasks.map((t) => t.date));
  const all = new Set([...days, ...taskDays]);
  let sum = 0;
  for (const k of all) sum += minutesOfDay(k);
  return sum;
}

export function overallStats() {
  const s = getState();
  const doneTasks = s.tasks.filter((t) => t.done).length;
  const totalMinutes = totalMinutesAllTime();
  const allKeys = new Set([...Object.keys(s.days), ...s.tasks.map((t) => t.date)]);
  let totalPomos = 0;
  for (const k of allKeys) totalPomos += pomodorosOfDay(k);
  const subs = s.subjects.map((sub) => ({ ...sub, stats: subjectStats(sub.id) }))
    .sort((a, b) => b.stats.minutes - a.stats.minutes);
  return {
    totalMinutes,
    totalPomos,
    doneTasks,
    totalTasks: s.tasks.length,
    streak: s.streak.current,
    longest: s.streak.longest,
    topSubject: subs[0] || null,
    subjects: subs,
  };
}

/** 14 ngày gần nhất */
export function lastNDays(n = 14) {
  const t = todayKey();
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = toKey(addDays(t, -i));
    const s = getState();
    const list = s.tasks.filter((x) => x.date === k);
    out.push({ key: k, minutes: minutesOfDay(k), pomodoros: pomodorosOfDay(k), tasks: list.filter((x) => x.done).length, total: list.length });
  }
  return out;
}

/** Trạng thái ngày cho lịch tháng: good | partial | missed | future | none */
export function dayStatus(key) {
  const t = todayKey();
  if (key > t) return 'future';
  const s = getState();
  const list = s.tasks.filter((x) => x.date === key);
  const done = list.filter((x) => x.done).length;
  const mins = minutesOfDay(key);
  if (list.length && done === list.length) return 'good';
  if (done > 0 || mins >= 25) return list.length ? 'partial' : 'good';
  if (list.length || key < t) return key === t ? 'none' : 'missed';
  return 'none';
}

export function moodStats() {
  const s = getState();
  const count = { tired: 0, normal: 0, good: 0, fire: 0 };
  for (const d of Object.values(s.days)) if (d.mood && count[d.mood] !== undefined) count[d.mood]++;
  return count;
}
