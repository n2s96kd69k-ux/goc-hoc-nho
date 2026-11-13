// ===== Dữ liệu mẫu cho lần mở đầu tiên =====
import { uid, todayKey, startOfWeek, weekKeys, toKey, addDays } from './utils.js';
import { starterRoom } from './items.js';

export function createDefaultSubjects() {
  return [
    { id: 'math', name: 'Toán', color: '#C8DDEE', icon: '📐', chapters: ['Hàm số', 'Hình học không gian', 'Tích phân', 'Xác suất'], scores: [{ date: '', score: 7.5, note: 'Đề thử số 1' }] },
    { id: 'lit', name: 'Ngữ văn', color: '#F4C8C5', icon: '📖', chapters: ['Đọc hiểu', 'Nghị luận xã hội', 'Nghị luận văn học'], scores: [] },
    { id: 'eng', name: 'Tiếng Anh', color: '#D8CEE8', icon: '🌍', chapters: ['Từ vựng', 'Ngữ pháp', 'Đọc hiểu', 'Viết lại câu'], scores: [] },
  ];
}

export function createSeedTasks() {
  const monday = startOfWeek(todayKey());
  const keys = weekKeys(monday);
  const mk = (day, title, subject, done, minutes, pomos = 1, priority = 'medium') => ({
    id: uid(), title, subjectId: subject, date: keys[day], done, minutes, pomodoros: pomos,
    priority, note: '', createdAt: Date.now(), completedAt: done ? Date.now() : null,
    sample: true,
  });
  return [
    mk(0, 'Ôn công thức', 'math', true, 30, 1),
    mk(0, 'Làm 20 câu Toán', 'math', true, 45, 2, 'high'),
    mk(0, 'Chữa bài', 'math', false, 30, 1),
    mk(1, 'Đọc Văn', 'lit', true, 40, 1),
    mk(1, 'Viết dàn ý', 'lit', false, 30, 1, 'high'),
    mk(2, 'Học từ vựng', 'eng', false, 25, 1),
    mk(2, 'Làm bài đọc', 'eng', false, 35, 1),
    mk(3, 'Làm đề', 'math', false, 90, 3, 'high'),
    mk(4, 'Chữa đề', 'math', false, 60, 2),
    mk(5, 'Ôn lại', 'lit', false, 45, 2),
    mk(6, 'Tổng kết tuần', 'eng', false, 30, 1, 'low'),
  ];
}

/** Dữ liệu ngày mẫu (thời gian học, pomodoro, mood) để UI không trống */
export function createSeedDays() {
  const monday = startOfWeek(todayKey());
  const days = {};
  const t = todayKey();
  const samples = [
    { m: 75, p: 3, mood: 'good' },
    { m: 60, p: 2, mood: 'normal' },
  ];
  const keys = weekKeys(monday);
  let si = 0;
  for (const k of keys) {
    if (k < t && si < samples.length) {
      days[k] = { minutes: samples[si].m, pomodoros: samples[si].p, mood: samples[si].mood, note: '', sample: true };
      si++;
    }
  }
  for (let i = 1; i <= 5; i++) {
    const k = toKey(addDays(monday, -i));
    days[k] = { minutes: 40 + i * 10, pomodoros: 2, mood: i % 2 ? 'good' : 'normal', note: '', sample: true };
  }
  return days;
}

export const SAMPLE_TASKS = [
  { title: 'Ôn công thức', subjectId: 'math' },
  { title: 'Làm 20 câu Toán', subjectId: 'math' },
  { title: 'Chữa bài', subjectId: 'math' },
  { title: 'Đọc Văn', subjectId: 'lit' },
  { title: 'Viết dàn ý', subjectId: 'lit' },
  { title: 'Học từ vựng', subjectId: 'eng' },
  { title: 'Làm bài đọc', subjectId: 'eng' },
  { title: 'Làm đề', subjectId: 'math' },
  { title: 'Chữa đề', subjectId: 'math' },
  { title: 'Ôn lại', subjectId: 'lit' },
  { title: 'Tổng kết tuần', subjectId: 'eng' },
];

export const SIDEBAR_DEFAULT = { calendar: true, progress: false, time: false, goal: true, mascot: false };

export function isSampleTask(task) {
  return !!(task && SAMPLE_TASKS.some((s) => s.title === task.title && s.subjectId === task.subjectId));
}

/** Trạng thái trống: không task, không xu, không đồ, không thống kê. Giữ môn và cài đặt lúc gọi. */
export function createBlankState() {
  return {
    version: 2,
    settings: { userName: 'Bạn nhỏ', focusMinutes: 25, breakMinutes: 5, sound: true, seeded: false, sidebar: { ...SIDEBAR_DEFAULT } },
    subjects: createDefaultSubjects(),
    tasks: [],
    days: {},
    wallet: { coins: 0, totalEarned: 0 },
    streak: { current: 0, longest: 0, lastDate: null, rewarded: {} },
    room: {
      theme: 'cream',
      owned: {},
      placed: [],
      lampOverride: null,
      weather: 'auto',
      presets: [],
      version: 2,
    },
    mascot: { accessory: null, name: 'Mochi' },
    goal: { name: '', examDate: '', targetScore: '', icon: '🏛️', note: '' },
    timer: { totalFocusMinutes: 0, totalPomodoros: 0, bySubject: {}, pomosBySubject: {} },
    ui: { viewWeek: null, viewDay: null, filter: 'all' },
  };
}

export function createInitialState() {
  return {
    version: 2,
    settings: { userName: 'Bạn nhỏ', focusMinutes: 25, breakMinutes: 5, sound: true, seeded: true, sidebar: { ...SIDEBAR_DEFAULT } },
    subjects: createDefaultSubjects(),
    tasks: createSeedTasks(),
    days: createSeedDays(),        // { 'YYYY-MM-DD': { minutes, pomodoros, mood, note } }
    wallet: { coins: 50, totalEarned: 50 },
    streak: { current: 0, longest: 5, lastDate: null, rewarded: {} },
    room: starterRoom(),            // xem items.js — theme / owned / placed / presets
    mascot: { accessory: null, name: 'Mochi' },
    goal: { name: 'Học viện Cán bộ', examDate: '', targetScore: '', icon: '🏛️', note: '' },
    timer: { totalFocusMinutes: 0, totalPomodoros: 0 },
    ui: { viewWeek: null, viewDay: null, filter: 'all' },
  };
}
