import { getCurrentUser } from './cloud.js';
import { streakTotals } from './gamification.js';
import { getState, update } from './state.js';
import { exportToFile } from './storage.js';
import { studyDay, studyDayKeys, subjectStudyTotals } from './study-account.js';
import { editablePlanner } from './sync.js';
import { walletBackupData, walletMode } from './wallet-account.js';

export function exportAccountBackup() {
  const state = getState();
  const mode = walletMode();
  if (mode === 'unavailable' || (state._syncUid && state._syncUid !== getCurrentUser()?.uid)) {
    throw new Error('Chưa tải được dữ liệu của tài khoản đang mở.');
  }
  if (mode === 'legacy') {
    exportToFile(state);
    return;
  }
  const account = walletBackupData();
  if (!account || state._syncUid !== getCurrentUser()?.uid) {
    throw new Error('Chưa tải đủ xu, kho đồ và lịch sử từ máy chủ. Hãy thử lại khi có mạng.');
  }
  const days = {};
  let totalFocusMinutes = 0;
  let totalPomodoros = 0;
  for (const date of studyDayKeys()) {
    const { minutes, focusMinutes, pomodoros } = studyDay(date);
    days[date] = {...state.days[date], minutes, pomoMinutes:focusMinutes, pomodoros,
      taskCoins:account.studyDays.get(date)?.taskCoinsIssued ?? 0};
    totalFocusMinutes += minutes;
    totalPomodoros += pomodoros;
  }
  const bySubject = {};
  const pomosBySubject = {};
  for (const subject of state.subjects) {
    const totals = subjectStudyTotals(subject.id);
    bySubject[subject.id] = totals.minutes;
    pomosBySubject[subject.id] = totals.pomodoros;
  }
  const { studyEvents, ...snapshot } = state;
  exportToFile({...snapshot, tasks:account.tasks, days, wallet:account.wallet,
    room:{...state.room, owned:account.owned},
    timer:{totalFocusMinutes,totalPomodoros,bySubject,pomosBySubject},
    streak:streakTotals(),
  }, {reference:true});
}

export function restoreAccountPreferences(data) {
  const { settings, goal, dayNotes } = editablePlanner(data);
  return update(state => {
    if (settings) state.settings = {...state.settings, ...settings, seeded:state.settings.seeded};
    if (goal) state.goal = {...state.goal, ...goal};
    for (const [date, note] of Object.entries(dayNotes)) {
      state.days[date] = {...state.days[date], ...note};
    }
  }, {type:'settings'});
}
