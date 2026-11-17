# Quality pass 1 — 2026-11-17

References: [Front-End Checklist](https://github.com/thedaviddias/Front-End-Checklist), [clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript).

## Implemented

- Backup import: 5 MiB file/text limit, bounded recursive validation, rejection of unsafe object keys and HTML delimiters, validation of task/subject IDs and core fields, balances, daily counters, settings durations. Imported data is plain text; backups containing `<` or `>` are rejected rather than treated as rich HTML. This is not a complete versioned schema for every optional room/timer field. Existing seeded app state and a legacy raw-state fixture are covered by round-trip checks.
- Import confirmation escapes the balance independently. Modal titles are escaped. Callers intentionally passing HTML content to other modal bodies remain responsible for escaping untrusted values.
- Save errors: persistent cream feedback panel with retry and download-current-state actions. Local quota and cloud-write failures are handled separately; settings success text refers specifically to device storage. Export produces a backup of the in-memory state, including edits not saved locally. Retrying does not discard current state.
- Modals: initial focus, Tab/Shift+Tab containment, Escape, focus restoration, cleanup of keyboard listener on every close path, idempotent close. `hideClose` retains the existing non-dismissible behavior.
- Tests: fixed transaction fixture to distinguish notifications from audit logs; notification/import regression tests included in `npm test`.
- CI: `.github/workflows/quality.yml` runs unit tests, Firestore emulator tests and Chromium UI suites for main pushes and pull requests. Workflow results do not by themselves block existing GitHub Pages deployment or merges; that would require repository settings/deployment integration.

## Verification

- `npm test`: 30/30 passed locally.
- Firestore demo emulator: 11/11 passed, no production writes.
- Existing admin UI suite passed: role guard/revocation, coin actions, announcements and mobile admin layout (mocked Firebase).
- New quality UI suite passed on Chromium: actual app-state backup round trip, modal keyboard flow/focus restoration, quota feedback/recovery, cloud-error feedback/retry (mocked Firebase).
- Changed JavaScript syntax checks passed.
- Hosted GitHub Actions status must be inspected after the commit; local checks do not imply hosted CI success.

## Not addressed in this pass

- Authoritative wallet and anti-cheat: users can still update their client-owned state.
- Concurrent additive rewards/statistics: generic three-way merge still prefers local values on same-field conflicts.
- Lazy loading, performance measurements, Safari/Firefox and full accessibility audit.
- Firebase production verification with signed-in users; Firestore Rules have not changed.
