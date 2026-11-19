const {test} = require('node:test');
const assert = require('node:assert/strict');
const {start,legacyProfile} = require('./wallet-migration-fixture.cjs');
const load = () => import('../scripts/wallet-plan.mjs');

test('plans an exact wallet and preserves planner, daily usage and already claimed rewards', async () => {
 const {planWallet,catalogPlan} = await load();
 const profile = legacyProfile();
 const before = structuredClone(profile);
 const plan = planWallet({uid:'student',profile,asOf:start});
 assert.deepEqual(profile, before);
 assert.equal(plan.summary.balance, 65);
 assert.equal(plan.summary.totalEarned, 75);
 assert.equal(plan.summary.manualMinutes, 15);
 assert.deepEqual(plan.documents['ownedItems/plant_small'], {quantity:2,updatedAt:start});
 assert.equal(plan.documents['studyDays/2026-11-19'].focusMinutes, 50);
 assert.equal(plan.documents['studyDays/2026-11-19'].taskCoinsIssued, 5);
 assert.equal(plan.documents['studyDays/2026-11-19'].tasksDone, 1);
 assert.equal(plan.documents['rewardTasks/math-1'].coinGain, 5);
 assert.ok(plan.documents['rewardMilestones/week-2026-11-16']);
 assert.ok(plan.documents['rewardMilestones/streak-7-2026-11-18']);
 assert.equal(plan.planner.dayNotes['2026-11-19'].note, 'Ôn 2 chương');
 assert.equal('owned' in plan.planner.room, false);
 assert.deepEqual(catalogPlan().desk, {price:260,maxQty:1,active:true});
});

test('legacy room aliases migrate deterministically and malformed or cross-account data blocks the plan', async () => {
 const {planWallet} = await load();
 const profile = legacyProfile();
 profile.state.room = {version:1,placed:[{itemId:'lamp'}]};
 profile.state.inventory = ['lamp'];
 const plan = () => planWallet({uid:'student',profile,asOf:start});
 assert.deepEqual(plan(), plan());
 profile.state.inventory.push('unknown_item');
 assert.throws(plan, /chưa được nhận diện/);
 profile.state.inventory.pop();
 assert.equal(plan().documents['ownedItems/desk_lamp'].quantity, 1);
 assert.throws(() => planWallet({uid:'other',profile,asOf:start}), /khác/);
 profile.state.timer.session = {status:'paused'};
 assert.throws(plan, /kết thúc phiên/);
 delete profile.state.timer.session;
 profile.state.tasks[0].date = '2026-02-30';
 assert.throws(plan, /không phù hợp/);
});

test('migration writers reject real projects and non-local emulator addresses', async () => {
 const {emulator} = await import('../scripts/wallet-emulator.mjs');
 assert.throws(() => emulator('goc-hoc-48ad4', 'localhost:8787'), /demo/);
 assert.throws(() => emulator('demo-goc-hoc-nho', 'firebase.example:8787'), /demo/);
});
