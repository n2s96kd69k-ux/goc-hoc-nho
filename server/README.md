# Trusted economy implementation status

`economy.cjs` is server-only transaction logic for purchases and administrator grants/sets. It is not a callable endpoint and is not imported by the live app. The `authUid` argument must come from verified Firebase authentication, never request JSON. The Firestore instance must be the Admin SDK instance. All permission checks are explicit because Admin SDK bypasses Security Rules.

Implemented invariants:
- Current actor role/status checked even on retries; actor-scoped receipt identity binds all effective command parameters.
- Catalog controls price/quantity; verified identity controls purchase target.
- Wallet, ownership, receipt, and admin audit/notification writes commit together.
- All reads precede writes. Competing operations contend on the same wallet document.
- No implicit wallet creation or migration from untrusted client state.

Tests currently use a serializing in-memory transaction fixture, not the Firestore emulator. They verify command validation, atomic-write intent, retry/conflict behavior, revoked roles and insufficient funds. Real transaction contention and deployment still require emulator/integration coverage.

Architecture review decisions:
1. Migrate ownership together with balance. Protect `ownedItems` and make the frontend use it; locking only the wallet leaves a free-item bypass in legacy `state.room.owned`.
2. Store authoritative task completion/reward eligibility separately from editable task descriptions. A server must not trust `state.tasks.done`, `state.streak`, `state.days`, or `studyEvents` as proof of reward eligibility.
3. Focus session timing proves elapsed server time, not actual studying. Enforce one active session/account, expiry, finite duration, idempotent finish and server date assignment; offline rewards need an explicit product policy rather than pretending elapsed client time is trusted.
4. Daily task cap should be a gross-issued cap: undo must not reopen unlimited earning through repeated toggles. Any clawback policy must define behavior after coins were spent.
5. Freeze legacy economy before snapshot migration, create a versioned receipt once per account, and keep backup+hash+operator identity. Existing balances cannot be authenticated retroactively.
6. Admin grant/set must switch at the same cutover as purchases/rewards. Disable the legacy adminCredits path for migrated accounts to avoid two competing balances.
7. Rollback cannot simply restore old balances once new receipts exist. Stop new commands and reconcile the ledger first.
8. Subcollection event storage avoids the growing single-document client journal; never truncate that journal without a checkpoint and stale-client policy.

Remaining implementation: verified-auth callable adapter, focus state machine, authoritative task/weekly/streak rewards, migration tooling/dry-run, frontend adapters, final Security Rules and production cutover. The existing website still uses the legacy wallet. Do not deploy this module by itself and describe the wallet as protected.

Deployment access/billing status remains unknown. No billing changes, Firebase writes or Rules publication were performed by this review.
