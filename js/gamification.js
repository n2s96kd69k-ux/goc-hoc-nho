// ===== Game hóa: xu, chuỗi cố gắng, mục tiêu ngày/tuần, cây tiến độ =====
// Mua đồ / kho / phòng nằm ở room.js (single source of truth).
import { getState, update } from './state.js';
import { todayKey, addDays, toKey, startOfWeek, weekKeys } from './utils.js';

export const REWARDS = {
  TASK: 10,          // hoàn thành một nhiệm vụ
  POMODORO: 25,      // một phiên tập trung 25' (tỉ lệ theo phút)
  DAY_COMPLETE: 50,  // xong toàn bộ nhiệm vụ trong ngày
  WEEK_COMPLETE: 100,// xong toàn bộ nhiệm vụ trong tuần (≥ 5 nhiệm vụ)
  STREAK_7: 50,
  STREAK_14: 100,
};

/** Xu cho một phiên Pomodoro theo số phút (25' = 25 xu, luôn tỉ lệ, tối thiểu 1) */
export function pomodoroReward(minutes) {
  return Math.max(1, Math.round(minutes));
}

/** Cộng xu (có thể âm). Trả về số dư mới. */
export function addCoins(amount, reason = '') {
  update((s) => {
    s.wallet.coins = Math.max(0, (s.wallet.coins || 0) + amount);
    if (amount > 0) s.wallet.totalEarned = (s.wallet.totalEarned || 0) + amount;
  }, { type: 'coins', amount, reason });
  return getState().wallet.coins;
}

/** Ngày được tính là "có học" khi có ≥1 task xong hoặc ≥1 pomodoro / ≥15 phút */
export function isStudyDay(key) {
  const s = getState();
  const d = s.days[key];
  const hasTask = s.tasks.some((t) => t.date === key && t.done);
  return hasTask || (d && (d.pomodoros > 0 || d.minutes >= 15));
}

/** Tính lại chuỗi ngày học liên tiếp. Trả về { current, events[] } */
export function recomputeStreak() {
  const t = todayKey();
  let count = 0;
  let cursor = isStudyDay(t) ? t : toKey(addDays(t, -1));
  while (isStudyDay(cursor) && count < 3650) {
    count++;
    cursor = toKey(addDays(cursor, -1));
  }
  const events = [];
  update((st) => {
    st.streak.current = count;
    st.streak.longest = Math.max(st.streak.longest || 0, count);
    st.streak.lastDate = t;
    st.streak.rewarded = st.streak.rewarded || {};
    for (const [m, coins] of [[7, REWARDS.STREAK_7], [14, REWARDS.STREAK_14]]) {
      const k = `${m}`;
      if (count >= m && count % m === 0 && st.streak.rewarded[k] !== t) {
        st.streak.rewarded[k] = t;
        st.wallet.coins += coins;
        st.wallet.totalEarned += coins;
        events.push({ milestone: m, coins });
      }
    }
  }, { type: 'streak' });
  return { current: count, events };
}

/** Kiểm tra & thưởng "xong cả tuần" (mỗi tuần 1 lần). Trả về số xu thưởng hoặc 0. */
export function checkWeekComplete(dateKey) {
  const s = getState();
  const monday = toKey(startOfWeek(dateKey));
  const keys = new Set(weekKeys(startOfWeek(dateKey)));
  const tasks = s.tasks.filter((t) => keys.has(t.date));
  if (tasks.length < 5 || tasks.some((t) => !t.done)) return 0;
  s.streak.rewarded = s.streak.rewarded || {};
  if (s.streak.rewarded['week:' + monday]) return 0;
  update((st) => {
    st.streak.rewarded['week:' + monday] = true;
    st.wallet.coins += REWARDS.WEEK_COMPLETE;
    st.wallet.totalEarned += REWARDS.WEEK_COMPLETE;
  }, { type: 'coins', amount: REWARDS.WEEK_COMPLETE, reason: 'week' });
  return REWARDS.WEEK_COMPLETE;
}

/** Cấp độ cây theo tổng phút học */
export function treeStage(totalMinutes) {
  if (totalMinutes >= 1500) return { emoji: '🌳', sparkle: true, label: 'Cây rực rỡ', stage: 5 };
  if (totalMinutes >= 600) return { emoji: '🌳', sparkle: false, label: 'Cây lớn', stage: 4 };
  if (totalMinutes >= 300) return { emoji: '🌿', double: true, label: 'Bụi xanh', stage: 3 };
  if (totalMinutes >= 100) return { emoji: '🌿', label: 'Chồi lá', stage: 2 };
  return { emoji: '🌱', label: 'Mầm non', stage: 1 };
}
export function nextTreeThreshold(totalMinutes) {
  return [100, 300, 600, 1500].find((x) => x > totalMinutes) || null;
}
