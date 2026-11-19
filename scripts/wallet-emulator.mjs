import { isDeepStrictEqual } from 'node:util';
import { encode, decode } from '../worker/transport.mjs';
import { planWallet, catalogPlan, checksum } from './wallet-plan.mjs';

const migrationFields = ['planner', 'economyVersion'];
const buckets = ['economy', 'ownedItems', 'rewardTasks', 'studyDays', 'rewardMilestones', 'focusSessions', 'economyOperations'];
const decodeFields = document => decode({mapValue: {fields: document.fields}});
const encodeFields = value => encode(value).mapValue.fields;

export function emulator(projectId, host = process.env.FIRESTORE_EMULATOR_HOST) {
  if (!/^demo-[a-z0-9-]+$/.test(projectId) || !/^(?:127\.0\.0\.1|localhost):\d{1,5}$/.test(host || '')) {
    throw new Error('Chế độ ghi chỉ hỗ trợ dự án demo-* trên Firestore emulator cục bộ.');
  }
  const base = `http://${host}/v1/projects/${projectId}/databases/(default)`;
  const fullName = path => `projects/${projectId}/databases/(default)/documents/${path}`;
  async function api(path, body) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET', headers: {Authorization:'Bearer owner', 'Content-Type':'application/json'},
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    if (response.status === 404 && !body) return null;
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(`Firestore emulator trả ${response.status} (${data?.error?.status || 'unknown'}).`);
    }
    return response.json();
  }
  const get = path => api('/documents/' + path);
  async function list(userPath, transaction) {
    const groups = await Promise.all(buckets.map(async collectionId => {
      const rows = await api('/documents/' + userPath + ':runQuery', {
        structuredQuery: {from: [{collectionId}]}, transaction,
      });
      return rows.flatMap(row => row.document ? [row.document] : []);
    }));
    return groups.flat();
  }
  const create = (path, value) => ({
    update: {name: fullName(path), fields: encodeFields(value)}, currentDocument: {exists: false},
  });
  async function transaction(fn) {
    const {transaction} = await api('/documents:beginTransaction', {options:{readWrite:{}}});
    try {
      const read = async path => {
        const [row] = await api('/documents:batchGet', {documents:[fullName(path)], transaction});
        return row.found ?? null;
      };
      const writes = await fn(read, path => list(path, transaction));
      if (writes.length) await api('/documents:commit', {transaction, writes});
      else await api('/documents:rollback', {transaction});
      return writes.length;
    } catch (error) {
      await api('/documents:rollback', {transaction}).catch(() => {});
      throw error;
    }
  }
  return {projectId, fullName, create, get, transaction};
}

function profilePath(uid) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('UID không hợp lệ.');
  return 'users/' + uid;
}
export async function snapshotWallet(db, uid, asOf = Date.now()) {
  const raw = await db.get(profilePath(uid));
  if (!raw) throw new Error('Không tìm thấy hồ sơ.');
  const contents = { format: 1, projectId: db.projectId, uid, asOf, raw };
  return {...contents, sha256: checksum(contents)};
}

export function planSnapshot(backup) {
  const {sha256, ...contents} = backup;
  if (backup.format !== 1 || sha256 !== checksum(contents)) throw new Error('Bản sao không khớp checksum.');
  return planWallet({uid: backup.uid, asOf: backup.asOf, profile: decodeFields(backup.raw)});
}

function migrationFor(db, backup) {
  const plan = planSnapshot(backup);
  const path = profilePath(plan.uid);
  if (backup.projectId !== db.projectId || backup.raw.name !== db.fullName(path)) {
    throw new Error('Bản sao thuộc dự án hoặc UID khác.');
  }
  return {plan, path, fields: encodeFields({planner: plan.planner, economyVersion: 1})};
}

export async function applyWallet(db, backup) {
  const {plan, path, fields} = migrationFor(db, backup);
  return db.transaction(async (read, list) => {
    const profile = await read(path);
    if (!profile || backup.raw.updateTime !== profile.updateTime) throw new Error('Hồ sơ đã thay đổi. Cần tạo bản sao mới.');
    if ((await list(path)).length) throw new Error('Đã tồn tại dữ liệu ví máy chủ.');
    return [
      ...Object.entries(plan.documents).map(([name, value]) => db.create(path + '/' + name, value)),
      { update:{name:profile.name,fields}, updateMask:{fieldPaths:migrationFields},
        currentDocument:{updateTime:profile.updateTime} },
    ];
  });
}

export async function restoreWallet(db, backup) {
  const {plan, path, fields} = migrationFor(db, backup);
  return db.transaction(async (read, list) => {
    const profile = await read(path);
    const expected = {...backup.raw.fields, ...fields};
    const actualFields = {...profile?.fields};
    // Firestore can omit empty values/fields arrays or maps in its REST representation.
    for (const field of migrationFields) {
      if (actualFields[field]) actualFields[field] = encode(decode(actualFields[field]));
    }
    if (!profile || !isDeepStrictEqual(expected, actualFields)) {
      throw new Error('Hồ sơ đã thay đổi sau khi chuyển. Dừng khôi phục để giữ các chỉnh sửa.');
    }
    const actual = await list(path);
    const initial = new Map(Object.entries(plan.documents).map(([name, value]) => [
      db.fullName(path + '/' + name), encodeFields(value),
    ]));
    if (actual.length !== initial.size || actual.some(row => !isDeepStrictEqual(encodeFields(decodeFields(row)), initial.get(row.name)))) {
      throw new Error('Ví đã phát sinh dữ liệu sau khi chuyển. Dừng khôi phục để giữ giao dịch.');
    }
    return [
      ...actual.map(row => ({delete:row.name, currentDocument:{updateTime:row.updateTime}})),
      { update:{name:profile.name, fields:Object.fromEntries(migrationFields.flatMap(field =>
        Object.hasOwn(backup.raw.fields, field) ? [[field, backup.raw.fields[field]]] : []))},
        updateMask:{fieldPaths:migrationFields}, currentDocument:{updateTime:profile.updateTime} },
    ];
  });
}

export async function seedCatalog(db) {
  return db.transaction(async read => {
    const rows = Object.entries(catalogPlan());
    const existing = await Promise.all(rows.map(([id]) => read('catalog/' + id)));
    return rows.flatMap(([id, value], index) => {
      const row = existing[index];
      if (row && !isDeepStrictEqual(decodeFields(row), value)) throw new Error(`Giá hoặc giới hạn của ${id} đang khác catalog.`);
      return row ? [] : [db.create('catalog/' + id, value)];
    });
  });
}
