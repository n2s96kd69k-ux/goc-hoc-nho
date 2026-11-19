# Server task rewards — staged, not active

`transactTask` supports task-complete/task-undo against server-owned `users/{uid}/rewardTasks/{taskId}`. These documents must be created by future authoritative task APIs/migration, not client snapshots. Existing catch-all Rules deny browser access to this collection. No production documents have been created.

Atomic checks: authenticated account status, canonical wallet, existing authoritative task, expectedVersion and idempotency receipt. Two devices sharing an old version cannot both award coins. Completion grants up to 5, with a gross-issued cap of 25 per server Vietnam calendar day. Request reward amounts are ignored. Dates in the editable legacy planner are not proof of eligibility.

Proposed secure-mode behavior changes (must be surfaced in frontend before activation):
- Daily quota is gross issued; undo does not restore it, preventing repeated toggles from recycling the cap. Historical task dates use today's issuance quota.
- Undo claws back the recorded grant. If coins were spent and balance is insufficient, reject the entire undo instead of creating debt, partial state or a negative balance.
- Re-completing after undo uses remaining quota. `totalEarned` stays a gross statistic, not current balance.
- Server state versions prevent stale overwrites; frontend must refresh and explain the conflict.

Tests use a serial transaction fixture, not real Firestore contention. Current 4 task cases cover concurrent cap enforcement, ignored client rewards, retry/conflict/version guards and undo behavior. Integration remains: task create/edit/delete lifecycle, daily completion aggregates for week/streak rewards, authenticated frontend adapters, migration and emulator end-to-end tests. Cloudflare does not need updating until the integrated release is ready. Legacy production task rewards are unchanged by this server-only commit.
