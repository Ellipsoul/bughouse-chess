# Match statistics

Open `mockups.html` for three compact dropdown alternatives. The screenshot shows their default states. Option C is implemented: keyboard-accessible Material/Moves tabs in a fixed-height footer for matches and partner adventures.

- **A:** existing player material rows plus one moves row.
- **B (recommended):** team balances and board moves, with expandable player detail.
- **C:** material/moves tabs with a fixed footer height.

## Data contract

`matchStatistics` on `sharedGames/{id}` stores version 1, a replay-input fingerprint, game count, source-board A/B action counts, and material balances by lowercase username for both bughouse and standard piece values. One action includes a drop; it is not a full white/black move pair. Material means net captures minus losses, matching the existing feature. Partner adventure opponents are summed across all usernames outside the selected pair.

All consumers use `getMatchStatistics`. Concurrent requests share a promise, completed results survive component unmounts, and up to 100 completed match entries persist in browser localStorage. Storage denial/quota exhaustion falls back to memory. Changing inputs or the version invalidates persisted totals. Games/arrays are treated as immutable, consistent with viewer state. A failed replay produces unavailable material, never a partial total; valid action counts remain usable.

New match/partner uploads include statistics in the parent document. Single-game uploads do not. Loading a complete match hydrates the cache from Firestore. Missing/stale statistics invoke `POST /api/shared-games/{id}/statistics`, which reads stored game payloads and transactionally writes derived statistics. It accepts no client totals, requires no login for public matches, and leaves Firestore rules unchanged. Incomplete uploads, individual games, and deleted documents are rejected. Concurrent server instances may perform duplicate work during the first backfill; transactional updates converge on the same result.

The endpoint uses the existing Firebase Admin configuration (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, or the supported emulator setup). If backfill is unavailable, local calculation/cache still work and persistence is retried on the next match load. Deploy the application to enable the new endpoint; no database migration or rules deployment is required. Existing matches are backfilled lazily.

## Verification

Unit tests cover action counts, both presets, shared in-flight work, remount/navigation reuse, browser cache reloads, Firestore hydration, invalidation, malformed/incomplete input, partner opponents, upload serialization, legacy backfill, incomplete uploads, singles, missing documents, and offline failures. The mockup tabs and disclosure are browser-checked. Production Firestore writes require an environment configured with Firebase credentials; tests use mocked Firestore boundaries.

Option C was also checked in headless Chromium using the real component and recorded games: both match modes retained a 128px footer, kept the game list stationary, showed no overflow, and supported keyboard tab switching. A Cypress regression test covers the same geometry; this workspace could not run Cypress because Xvfb is missing.
