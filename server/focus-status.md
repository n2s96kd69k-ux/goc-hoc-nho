# Trusted focus commands — implementation status

Implemented server-only `transactFocus`: focus-start, focus-pause, focus-resume, focus-complete and focus-cancel. The Worker dispatches these commands through the existing authenticated /api/economy endpoint.

- Account status, canonical-wallet version and current account-wide active session checked inside the transaction.
- Duration is an integer 1–180 minutes; reward derives from stored duration. Client amounts and timestamps are ignored.
- Pause excludes elapsed wall time until resume. Session expires after 24 hours; cancellation remains available after expiry to release the account lock.
- Start date uses server Vietnam time. One active session per account. Completion updates wallet, totalEarned, daily focus minutes/pomodoros and receipt atomically.
- Repeated operation returns original receipt. A second complete with another operation ID returns the stored completion result. Conflicting operation reuse fails.
- This measures elapsed server time, not actual attention. Continuous presence/anti-bot checks are not implemented.

Verification: serializing in-memory transaction tests cover early completion, ignored client reward, pause/resume, account-wide exclusivity, duplicate/concurrent completions, cancel, invalid duration and banned accounts. Real Firestore contention and end-to-end signed-in browser integration are not yet tested.

Not activated: no canonical wallets created, no balances migrated, no frontend timer adapter switched. Other reward commands (task/week/streak), subject aggregates and manual-time server commands remain to implement. Do not manually create a wallet: migration gate in Rules freezes legacy state, and the production frontend is not yet ready for cutover. The deployed Worker can remain at the previous diagnostic version until the integrated rollout is ready.
