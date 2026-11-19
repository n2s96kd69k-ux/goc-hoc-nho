import { createHash } from 'node:crypto';
import { ITEMS, getItemDef } from '../js/items.js';
import { legacyItemId, migrateRoom } from '../js/room-migration.js';
import { parseImportFile } from '../js/storage.js';
import { editablePlanner, applyAdminCredits } from '../js/sync.js';
import taskModule from '../server/tasks.cjs';
import rewardsModule from '../server/study-rewards.cjs';

const { parseTaskFields } = taskModule;
const { studyDate } = rewardsModule;
const limit = 1000000000;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const taskFields = ['title', 'date', 'subjectId', 'minutes', 'pomodoros', 'priority', 'note', 'order'];

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function integer(value, label, minimum = 0, maximum = limit) {
  check(Number.isSafeInteger(value) && value >= minimum && value <= maximum, `${label} nằm ngoài giới hạn.`);
  return value;
}
function pick(object, keys) {
  return Object.fromEntries(keys.filter(key => Object.hasOwn(object, key)).map(key => [key, object[key]]));
}
export function catalogPlan() {
  return Object.fromEntries(ITEMS.map(({ id, price, maxQty }) => [id, { active: true, price, maxQty }]));
}
export function checksum(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function planWallet({ uid, profile, asOf }) {
  check(safeId(uid) && record(profile), 'Thiếu UID hoặc hồ sơ hợp lệ.');
  integer(asOf, 'Thời điểm đối chiếu', 0, 253402275599999);
  check(!profile.economyVersion && profile.status !== 'banned', 'Tài khoản đã chuyển ví hoặc đang bị khóa.');
  const state = parseImportFile(JSON.stringify(profile.state ?? null));
  check(!state._syncUid || state._syncUid === uid, 'Bản sao thuộc tài khoản khác.');
  check(!['running', 'paused'].includes(state.timer?.session?.status), 'Cần kết thúc phiên Pomodoro cũ trước khi đối chiếu.');
  const warnings = [];
  const credits = integer(profile.adminCredits ?? 0, 'Điều chỉnh xu quản trị', -limit);
  const priorCredits = integer(state.wallet.adminCreditsApplied ?? 0, 'Điều chỉnh xu đã áp dụng', -limit);
  const legacyBalance = integer(state.wallet.coins, 'Số dư cũ');
  const balance = integer(applyAdminCredits(state, credits).wallet.coins, 'Số dư sau đối chiếu');
  const totalEarned = integer(state.wallet.totalEarned ?? legacyBalance, 'Tổng xu đã nhận');
  const profileState = structuredClone(state);
  let layoutId = 0;
  if (state.room?.version !== 2) {
    const inventory = state.inventory || [];
    const placed = state.room?.placed || [];
    check(Array.isArray(inventory) && Array.isArray(placed), 'Kho hoặc bố cục phòng cũ không hợp lệ.');
    const legacyIds = [...inventory, ...placed.map(item => item?.itemId)];
    if (state.mascot?.accessory) legacyIds.push(state.mascot.accessory);
    check(legacyIds.every(id => safeId(id) && getItemDef(legacyItemId(id))), 'Phòng cũ có vật phẩm chưa được nhận diện.');
    warnings.push('Bố cục phòng cũ được chuyển theo quy tắc của ứng dụng.');
  } else {
    check(record(state.room.owned) && Array.isArray(state.room.placed), 'Kho hoặc bố cục phòng không hợp lệ.');
  }
  profileState.room = migrateRoom(profileState, () => `legacy-room-${++layoutId}`);
  if (state.room?.version !== 2 && layoutId !== (state.room?.placed || []).length) {
    warnings.push('Một số đồ đặt từ phòng cũ chưa tìm được vị trí. Kiểm tra bố cục trước khi chuyển.');
  }
  const planner = editablePlanner(profileState);
  const documents = {'economy/wallet': {
    version: 1, balance, totalEarned, activeSessionId: null, migratedAt: asOf, updatedAt: asOf,
  }};

  for (const [id, quantity] of Object.entries(profileState.room.owned)) {
    check(!!getItemDef(id), `Vật phẩm ${id} chưa có trong catalog.`);
    integer(quantity, `Số lượng ${id}`);
    if (!quantity) continue;
    if (quantity > getItemDef(id).maxQty) warnings.push(`Giữ nguyên số lượng cũ của ${id} dù vượt giới hạn mua mới.`);
    documents['ownedItems/' + id] = { quantity, updatedAt: asOf };
  }

  const days = new Map();
  const getDay = key => {
    if (!days.has(key)) days.set(key, {focusMinutes: 0, pomodoros: 0, tasksDone: 0, tasksTotal: 0, taskCoinsIssued: 0});
    return days.get(key);
  };
  let manualMinutes = 0;
  let sampleRows = 0;
  for (const [key, row] of Object.entries(state.days)) {
    check(date(key), `Ngày học ${key} không hợp lệ.`);
    const day = getDay(key);
    const minutes = integer(row.minutes ?? 0, `Phút học ngày ${key}`);
    day.pomodoros = integer(row.pomodoros ?? 0, `Số Pomodoro ngày ${key}`);
    day.focusMinutes = integer(row.pomoMinutes ?? (day.pomodoros ? minutes : 0), `Phút Pomodoro ngày ${key}`, 0, minutes);
    manualMinutes += minutes - day.focusMinutes;
    day.taskCoinsIssued = integer(row.taskCoins ?? 0, `Xu nhiệm vụ ngày ${key}`, 0, 25);
    if (row.sample) sampleRows++;
  }

  for (const task of state.tasks) {
    check(safeId(task.id), 'Có nhiệm vụ có mã không hợp lệ.');
    let fields;
    try { fields = parseTaskFields(pick(task, taskFields), true); }
    catch { throw new Error(`Nhiệm vụ ${task.id} có trường không phù hợp với API mới.`); }
    const coinGain = integer(task.coinGain ?? 0, `Xu nhiệm vụ ${task.id}`, 0, 5);
    check(task.done || coinGain === 0, `Nhiệm vụ ${task.id} chưa xong nhưng có xu đã nhận.`);
    documents['rewardTasks/' + task.id] = {
      id: task.id, ...fields, done: task.done, coinGain, version: 0,
      createdAt: integer(task.createdAt ?? asOf, `Ngày tạo ${task.id}`, 0, 253402275599999),
      completedAt: task.done ? integer(task.completedAt ?? asOf, `Ngày hoàn thành ${task.id}`, 0, 253402275599999) : null,
      updatedAt: asOf, ...(task.sample === true ? {sample: true} : {}),
    };
    const day = getDay(fields.date);
    day.tasksTotal++;
    if (task.done) day.tasksDone++;
    if (task.sample) sampleRows++;
  }

  for (const [key, value] of Object.entries(state.streak?.rewarded || {})) {
    if (!value) continue;
    const week = /^week:(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (week && date(week[1]) && value === true && new Date(week[1]).getUTCDay() === 1) {
      documents['rewardMilestones/week-' + week[1]] = {kind: 'week', date: week[1], coins: 100, createdAt: asOf};
      continue;
    }
    if ((key === '7' || key === '14') && date(value)) {
      const yesterday = new Date(Date.parse(value) - 86400000).toISOString().slice(0, 10);
      // Legacy awards used the day the app opened. Preserve both candidate streak ends.
      for (const end of [value, yesterday]) {
        documents[`rewardMilestones/streak-${key}-${end}`] = {
          kind: 'streak', milestone: Number(key), date: end, coins: key === '7' ? 50 : 100, createdAt: asOf,
        };
      }
      warnings.push(`Mốc chuỗi ${key} có hai ngày kết thúc có thể trùng. Cần duyệt trước khi chuyển thật.`);
      continue;
    }
    throw new Error(`Mốc thưởng ${key} chưa có quy tắc chuyển đổi.`);
  }
  for (const [key, day] of days) documents['studyDays/' + key] = {...day, updatedAt: asOf};
  if (sampleRows) warnings.push(`Có ${sampleRows} bản ghi mẫu. Cần duyệt cách giữ lịch sử và xét thưởng trước khi chuyển thật.`);
  const counts = {};
  for (const name of Object.keys(documents)) {
    const bucket = name.split('/')[0];
    counts[bucket] = (counts[bucket] || 0) + 1;
  }
  check(Object.keys(documents).length < 500, 'Tài khoản vượt kích thước chuyển nguyên tử của công cụ.');
  return { uid, asOf, day: studyDate(asOf), planner, documents, warnings,
    summary: { legacyBalance, credits, priorCredits, balance, totalEarned, manualMinutes, counts } };
}
