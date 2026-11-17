# Study synchronization and trusted-wallet rollout

## Implemented in this change

- Completed Pomodoro and manually entered study time record immutable `studyEvents` keyed by session UUID/operation UUID.
- Three-way merge reconciles contributions from new events before merging scalar state. Two distinct sessions add their contributions; the same restored session contributes once. Dates and subject totals are included. Duplicate IDs with inconsistent metadata fail visibly instead of silently guessing.
- New sessions retain their accounting date across reload/midnight (date of session start). Legacy timers without IDs get an ID derived from the stored end time/duration.
- Firestore transaction returns its committed snapshot. The client applies it using the submitted snapshot as a baseline, preserving edits made while the request was in flight and the local running timer controls.
- Existing rewards and snapshots are not converted retroactively into events. Other device changes are incorporated on the next successful save/login/reconnect; this is not a new realtime full-state listener.

## Not implemented / not protected

- This client event journal is a synchronization mechanism, not an anti-cheat boundary. Rules still allow updating client state.
- Task, weekly and streak reward conflicts, simultaneous purchases and inventory/overspend races are not solved by the study-event journal.
- Journal remains inside the existing user state document. It must not be silently truncated (that can replay older sessions). At higher volume it needs migration to per-operation server documents to stay below Firestore's document-size limit.
- No server wallet, Cloud Functions, migration script, billing change or new Rules deployment has been activated.

## Concrete target architecture for the next phase

All authenticated money-affecting requests go through trusted server commands; clients cannot supply a balance, price, reward amount or authoritative duration.

Data:

- `users/{uid}/economy/wallet`: server-owned balance, totalEarned, version, migratedAt.
- `users/{uid}/economyOperations/{operationId}`: immutable idempotency receipt (request identity, type, result, server timestamp).
- `users/{uid}/focusSessions/{sessionId}`: server start/pause/resume/end times, accumulated elapsed focus time, completion marker.
- `users/{uid}/studyDays/{date}`: server-owned focus/manual totals and task-reward cap usage.
- `catalog/{itemId}`: trusted prices, quantity limits and item type.

Commands:

1. Begin/pause/resume/complete focus: authenticated owner; server timestamps determine elapsed time; one active session per account; completing a session atomically writes the receipt, updates wallet and increments study totals. A repeated request returns its previous receipt. Manual time has a separate type and cannot earn focus coins.
2. Complete/undo task: read the task and current reward state from Firestore; enforce the daily cap inside the transaction, never from a submitted amount. Week/streak milestones have deterministic receipt IDs.
3. Buy item: server reads catalog price, wallet and owned quantity, validates funds/limits and atomically updates wallet/inventory/receipt. Competing purchases serialize through the wallet transaction.
4. Admin grant/set: verify current actor role/status, apply the adjustment in the same canonical wallet transaction and append the existing audit/notification. No second balance source.

Migration/activation:

1. Confirm Firebase deployment access and billing/service availability; do not assume Blaze is enabled.
2. Back up current user documents. Resolve which existing balances to preserve; existing client-modifiable history cannot prove historical earnings.
3. Build and emulator-test commands + frontend adapters for **all** reward and purchase paths. Check offline behavior, retries, account switching and old clients.
4. Freeze old money writes at cutover, migrate snapshot balances exactly once with version markers; keep rollback backups. Deploy server and matching client before enforcing canonical-wallet Rules.
5. Publish Rules denying client writes to wallet, operation receipts, authoritative study totals and inventory; make old-client behavior explicit instead of leaving a writable bypass.
6. Verify with two real accounts/devices before enabling broadly. A rollback must preserve receipts and reconcile operations created after migration; do not blindly restore an old wallet snapshot.

This plan has not been deployed and must not be described as completed wallet protection. No Firebase production credentials are available in this session. An Astra review would be useful for the authority boundaries and migration invariants; it does not replace Firebase deployment access or billing confirmation.
