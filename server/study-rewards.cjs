// The session clock and task state come from the server.
const studyDayMs = 86400000;
const studyDate = now => new Date(now + 7 * 3600000).toISOString().slice(0, 10);
const shiftStudyDate = (date, days) => new Date(Date.parse(date + 'T00:00:00Z') + days * studyDayMs).toISOString().slice(0, 10);

function studyRewards(tx, ref) {
 const cached = new Map();
 const changed = new Set();
 const awards = [];
 const dayRef = date => ref('studyDays/' + date);

 async function readDays(dates) {
  const missing = [...new Set(dates)].filter(date => !cached.has(date));
  if (missing.length) {
   const refs = missing.map(dayRef);
   const snapshots = tx.getAll ? await tx.getAll(...refs) : await Promise.all(refs.map(r => tx.get(r)));
   snapshots.forEach((snapshot, i) => cached.set(missing[i], snapshot.exists ? snapshot.data() : {}));
  }
  return dates.map(date => cached.get(date));
 }

 function counter(day, field) {
  const value = day[field] ?? 0;
  if (!Number.isSafeInteger(value) || value < 0) throw Error('invalid-study-day');
  return value;
 }

 async function recordDay(date, update) {
  const [day] = await readDays([date]);
  const next = {...day};
  for (const [field, delta] of Object.entries(update)) {
   next[field] = counter(day, field) + delta;
   counter(next, field);
  }
  if (counter(next, 'tasksDone') > counter(next, 'tasksTotal')) throw Error('invalid-study-day');
  cached.set(date, next);
  changed.add(date);
  return next;
 }

 async function recordTask(previous, next) {
  if (previous && next && previous.date === next.date) {
   const difference = Number(next.done) - Number(previous.done);
   if (difference) await recordDay(next.date, {tasksDone: difference});
   return;
  }
  if (previous) await recordDay(previous.date, {tasksTotal: -1, tasksDone: -Number(previous.done)});
  if (next) await recordDay(next.date, {tasksTotal: 1, tasksDone: Number(next.done)});
 }

 async function claim(id, coins, details) {
  const marker = ref('rewardMilestones/' + id);
  if ((await tx.get(marker)).exists) return 0;
  awards.push({marker, coins, details});
  return coins;
 }

 async function weekly(date) {
  const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  const monday = shiftStudyDate(date, -((weekday + 6) % 7));
  const days = await readDays(Array.from({length: 7}, (_, i) => shiftStudyDate(monday, i)));
  const total = days.reduce((sum, day) => sum + counter(day, 'tasksTotal'), 0);
  const done = days.reduce((sum, day) => sum + counter(day, 'tasksDone'), 0);
  return total >= 5 && total === done ? claim('week-' + monday, 100, {kind: 'week', date: monday}) : 0;
 }

 async function streak(today) {
  const qualifies = day => counter(day, 'focusMinutes') >= 45 && counter(day, 'tasksDone') >= 3;
  const [current, previous] = await readDays([today, shiftStudyDate(today, -1)]);
  const end = qualifies(current) ? today : qualifies(previous) ? shiftStudyDate(today, -1) : null;
  if (!end) return {current: 0, events: []};

  let count = 1;
  while (count < 3650) {
   // Keep reads small for typical streaks and bound request count for long ones.
   const length = Math.min(count < 16 ? 16 : 128, 3650 - count);
   const batch = await readDays(Array.from({length}, (_, i) => shiftStudyDate(end, -(count + i))));
   const gap = batch.findIndex(day => !qualifies(day));
   count += gap < 0 ? batch.length : gap;
   if (gap >= 0) break;
  }

  const events = [];
  for (const [milestone, coins] of [[7, 50], [14, 100]]) {
   if (count % milestone === 0 && await claim('streak-' + milestone + '-' + end, coins, {kind: 'streak', date: end, milestone})) {
    events.push({milestone, coins});
   }
  }
  return {current: count, events};
 }

 function write(now) {
  for (const date of changed) tx.set(dayRef(date), cached.get(date));
  for (const {marker, coins, details} of awards) tx.create(marker, {...details, coins, createdAt: now});
 }
 return {recordDay, recordTask, weekly, streak, write};
}
module.exports={studyRewards,studyDate};
