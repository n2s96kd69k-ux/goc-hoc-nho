# Server task rewards — staged, not active

`transactTask` supports create, edit, delete, complete and undo against server-owned `users/{uid}/rewardTasks/{taskId}`. All commands use the authenticated account and the existing Worker endpoint `POST /api/economy`. Existing Rules keep task records private to the server until the read path is added for the frontend.

| Command | Required input | Result |
| --- | --- | --- |
| `task-create` | `operationId`, `taskId`, `fields` with title and date | A task at version zero, incomplete and with zero reward |
| `task-edit` | `operationId`, `taskId`, `expectedVersion`, `fields` | Full task with its incremented version and updated content |
| `task-delete` | `operationId`, `taskId`, `expectedVersion` | Deletion record with ID, version and time. The old ID cannot be reused |
| `task-complete` / `task-undo` | `operationId`, `taskId`, `expectedVersion` | Completion status, version, balance and reward delta |

Create and edit accept title, date, subject ID, planned minutes, planned Pomodoros, priority, note and order. The server sets completion and reward fields. Editing a task leaves its reward alone. Deletion removes task content from the current task document and retains the existing balance, as in the legacy planner. Older operation receipts remain available for retries.

Atomic checks: authenticated account status, canonical wallet, existing authoritative task, expectedVersion and idempotency receipt. Two devices sharing an old version cannot both award coins. Completion grants up to 5, with a gross-issued cap of 25 per server Vietnam calendar day. Request reward amounts are ignored. Dates in the editable legacy planner are not proof of eligibility.

Proposed secure-mode behavior changes (must be surfaced in frontend before activation):
- Daily quota is gross issued; undo does not restore it, preventing repeated toggles from recycling the cap. Historical task dates use today's issuance quota.
- Undo claws back the recorded grant. If coins were spent and balance is insufficient, reject the entire undo instead of creating debt, partial state or a negative balance.
- Re-completing after undo uses remaining quota. `totalEarned` stays a gross statistic, not current balance.
- Server state versions prevent stale overwrites; frontend must refresh and explain the conflict.

Tests use a serial transaction fixture, not real Firestore contention. Task cases cover concurrent cap enforcement, ignored client rewards, retry/conflict/version guards and undo behavior. The bundled Worker also runs against Firestore emulator for create, edit, complete, delete, retry, stale-version rejection and browser read denial. Google authentication responses are substituted in that test. The authenticated frontend read/write paths and migration remain open. Cloudflare does not need updating until the integrated release is ready. Legacy production task rewards are unchanged by this server-only commit.

## Weekly and streak rewards

Server task commands maintain `tasksTotal` and `tasksDone` on the planned study date, including both dates when moving tasks. Focus completion contributes `focusMinutes` to the server-side daily record. Weekly rewards require five or more tasks with all tasks completed from Monday through Sunday. Streak days require at least 45 focus minutes and three completed tasks. Completion grants 50 xu per multiple of seven eligible days and an additional 100 xu per multiple of fourteen. These thresholds and amounts follow the current planner.

The transaction writes the award, balance, and a server-only marker in `rewardMilestones` together. The weekly marker uses the Monday date. Streak markers use the final eligible date of the streak so a retry or the next morning cannot award the same streak again. Before cutover, migration must populate daily counters and preserve previous claimed milestones, and the frontend needs to show the server reward results. The server checks awards after an eligible task or focus operation. Frontend boot does not yet invoke a separate reward evaluation.
