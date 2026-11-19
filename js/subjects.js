import { subjectStudyTotals } from './study-account.js';
import { getCurrentUser } from './cloud.js';
import { walletMode } from './wallet-account.js';
import { sendTask, visibleTasks } from './task-account.js';
// ===== Môn học =====
import { getState, update } from './state.js';
import { uid, pct } from './utils.js';

export const SUBJECT_COLORS = ['#C8DDEE', '#F4C8C5', '#D8CEE8', '#BFD8B8', '#F3D993', '#F7D6E8', '#CDE7E3', '#F2D5B8'];
export const SUBJECT_ICONS = ['📐', '📖', '🌍', '🧪', '🧬', '🏛️', '🗺️', '💻', '🎨', '🎵', '⚖️', '✨'];

export function getSubject(id) {
  return getState().subjects.find((s) => s.id === id) || null;
}

export function addSubject(data) {
  const sub = {
    id: uid(),
    name: (data.name || '').trim() || 'Môn mới',
    color: data.color || SUBJECT_COLORS[getState().subjects.length % SUBJECT_COLORS.length],
    icon: data.icon || '📘',
    chapters: data.chapters || [],
    scores: [],
  };
  update((s) => { s.subjects.push(sub); }, { type: 'subject-add' });
  return sub;
}

export function updateSubject(id, patch) {
  update((s) => {
    const sub = s.subjects.find((x) => x.id === id);
    if (sub) Object.assign(sub, patch);
  }, { type: 'subject-update' });
}

export function deleteSubject(id) {
  if (walletMode() !== 'legacy') return removeServerSubject(id);
  update((s) => {
    s.subjects = s.subjects.filter((x) => x.id !== id);
    const fallback = s.subjects[0] ? s.subjects[0].id : null;
    s.tasks.forEach((t) => { if (t.subjectId === id) t.subjectId = fallback; });
  }, { type: 'subject-delete' });
}

async function removeServerSubject(id) {
  const user = getCurrentUser();
  await sendTask('task-subject-delete', null, { subjectId: id });
  if (user !== getCurrentUser() || walletMode() !== 'server') return;
  update(s => { s.subjects = s.subjects.filter(subject => subject.id !== id); }, { type: 'subject-delete' });
}

export function addScore(id, score, note) {
  update((s) => {
    const sub = s.subjects.find((x) => x.id === id);
    if (!sub) return;
    sub.scores = sub.scores || [];
    sub.scores.push({ date: new Date().toISOString().slice(0, 10), score: Number(score), note: note || '' });
  }, { type: 'subject-update' });
}

export function subjectStats(id) {
  const s = getState();
  const tasks = visibleTasks(s.tasks).filter((t) => t.subjectId === id);
  const done = tasks.filter((t) => t.done);
  const { minutes, pomodoros } = subjectStudyTotals(id);
  return {
    total: tasks.length,
    done: done.length,
    percent: pct(done.length, tasks.length),
    minutes,
    pomodoros,
  };
}
