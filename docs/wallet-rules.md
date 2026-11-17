# Canonical wallet Rules — staged activation

The full `firestore.rules` includes private read access to economy, economyOperations, ownedItems, focusSessions and studyDays for the active owner or administrator. Browser writes (including administrator browsers) to these collections and catalog are denied. Trusted Admin SDK commands must validate auth/role themselves.

Presence, announcements, university data, notifications and existing user access remain supported.

Migration gate: existence of users/{uid}/economy/wallet blocks ALL client changes to that user's legacy `state`, and blocks legacy adminCredits adjustments. Profile-only changes remain allowed. This intentionally freezes the legacy snapshot to prevent bypass through wallet, inventory or study totals. It is a staged cutover guard, not the final profile-only state schema.

Publishing these Rules does not migrate balances. Do not create canonical wallets by hand until the server commands and frontend adapters are deployed and the migration backup is ready. Creating one today will prevent the old client from saving that account's study state; this is an explicit lock, not a silent data conversion.

Current live legacy wallets remain client writable until cutover. These Rules alone do not provide full anti-cheat for the current website. The new subcollections were already denied by the catch-all; this change adds intended private read permissions and the legacy-write migration gate.

Verified with 14 emulator cases (including previous application Rules). No production Rules were published by the assistant: the session has GitHub access, not authenticated Firebase deployment access. Publish the entire repository firestore.rules in Firebase Console after reviewing the staged activation behavior above.
