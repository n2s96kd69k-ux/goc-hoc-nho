import { getCurrentUser } from './cloud.js';
import { getState } from './state.js';
import { serverStudyDays, walletMode } from './wallet-account.js';

const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function studyHistory() {
  const state = getState();
  return walletMode() === 'legacy' || state._syncUid === getCurrentUser()?.uid ? state : null;
}

export function studyDay(key) {
  const legacy = studyHistory()?.days[key] || {};
  const previousFocus = nonnegative(legacy.pomoMinutes ?? (legacy.pomodoros ? legacy.minutes : 0));
  if (walletMode() === 'legacy') return {
    minutes: nonnegative(legacy.minutes), focusMinutes: previousFocus, pomodoros: nonnegative(legacy.pomodoros),
  };

  const record = serverStudyDays()?.get(key);
  const focusMinutes = nonnegative(record?.focusMinutes);
  const manual = Math.max(0, nonnegative(legacy.minutes) - previousFocus);
  return { minutes: focusMinutes + manual, focusMinutes,
    pomodoros: nonnegative(record?.pomodoros), tasksDone: nonnegative(record?.tasksDone) };
}

export function studyDayKeys() {
  return new Set([...Object.keys(studyHistory()?.days || {}), ...(serverStudyDays()?.keys() || [])]);
}

export function subjectStudyTotals(id) {
  const { bySubject, pomosBySubject } = studyHistory()?.timer || {};
  let minutes = nonnegative(bySubject?.[id]);
  let pomodoros = nonnegative(pomosBySubject?.[id]);
  for (const day of serverStudyDays()?.values() || []) {
    if (!Object.hasOwn(day.subjects || {}, id)) continue;
    minutes += nonnegative(day.subjects[id].minutes);
    pomodoros += nonnegative(day.subjects[id].pomodoros);
  }
  return { minutes, pomodoros };
}
