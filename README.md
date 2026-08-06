# Relay — Bughouse Chess Replay & Analysis Tool

**[Try the App Here](https://bughouse.aronteh.com/)**

Relay is an elegant tool for **replaying and analyzing bughouse games from
chess.com**. It loads both boards of a bughouse match (the “partner” game),
merges the moves into a single timeline, and gives you a powerful two-board UI
for **drops**, **variations**, **live replay**, and **fast navigation**.

---

## For Players (everything you can do)

### Open a game

- **Paste a chess.com live game ID** (e.g. `159878252255`)
- **Or open a link directly**:
  `https://bughouse.aronteh.com/?gameId=159878252255`
- **Open shared games**: Use `?sharedId=<uuid>` to open games shared by other
  users
- **Sample games**: When visiting without a game ID, Relay suggests a random
  sample game to explore
- **Partner board auto-detection**
  - If chess.com provides `partnerGameId`, Relay uses it.
  - Otherwise, Relay probes nearby IDs to find the paired board.

### Replay the match (two boards, one timeline)

- **Two synchronized boards** (A and B) side-by-side.
- **Merged move timeline** ordered by timestamp so you can step through the
  match as it actually unfolded (including simultaneous-move quirks).
- **Clocks** shown per player (as provided by chess.com), synchronized to the
  current position.
- **Clock advantage visualization**: See time differences between teams with
  color-coded indicators
- **Material tracking**: Track captured pieces for bughouse scoring (pawn=1,
  knight/bishop=3, rook=5, queen=9)
- **Chess title badges**: Player titles (GM, IM, FM, etc.) are displayed next to
  usernames
- **Live replay mode**: play the match back in (approximate) real time using the
  original timestamps, with play/pause + seeking.

### Analyze positions interactively (bughouse-aware)

- **Make moves directly on the board** (drag-and-drop).
- **Bughouse drops**
  - Click a reserve piece to “arm” a drop, then click a target square.
  - Or drag reserve pieces onto the board.
- **Promotion picker**: when a move needs promotion, Relay asks you to pick a
  piece.
- **Reserves update correctly**: captures on one board feed the partner’s
  reserve.

### Variations (branching analysis)

- **Branching analysis tree**: explore alternative lines from any position.
- **Variation selector**: when a node has multiple continuations, stepping
  forward can open a selector.
- **Move list with inline variations**: a 4-column layout (A/B × white/black)
  with side lines shown under the relevant move.
- **Tools**
  - **Promote variation** (make a side line the mainline)
  - **Delete from here** (truncate continuations)

### Notes & quality-of-life

- **Board annotations**: add highlights/arrows to help reason about lines.
- **Keyboard navigation**
  - **Left/Right**: back/forward
  - **Up/Down**: jump to start/end of the current line
  - **f**: flip boards
  - Live replay intentionally disables most editing/navigation so playback stays
    stable.
- **Toasts**: clear feedback for load states, illegal moves, promotions, etc.
- **Responsive layout**: boards resize to fit available width; reserves support
  a compact density mode.

### Match navigation (multi-game)

If you're playing a bughouse match consisting of multiple consecutive games,
Relay can help you **discover and step through subsequent games** with the same
four players and the same team pairings (rate-limited to be gentle to
chess.com).

- **Match discovery**: Automatically finds all games in a match sequence
- **Match score tracking**: See wins, losses, and draws across the match
- **Board orientation**: Automatically maintains correct board orientation as
  teams swap colors
- **Navigation controls**: Jump between games in a match with forward/backward
  navigation

### Sharing & collaboration

- **Share games and matches**: Share individual games or entire matches with
  other users
- **Shared games browser**: Browse all shared games at `/shared-games`
- **Advanced filtering**: Filter shared games by player names (supports
  team-aware filtering)
- **Descriptions**: Add optional descriptions (up to 100 characters) when
  sharing
- **Profanity filtering**: Automatic filtering of inappropriate content in
  descriptions
- **Share links**: Each shared game gets a unique URL that can be shared
  directly

### User accounts & preferences

- **Google sign-in**: Authenticate with your Google account to unlock sharing
  features
- **Username reservation**: Reserve a unique username (one-time, cannot be
  changed later)
- **Profile page**: Manage your account and view your shared games
- **Settings**: Customize your experience
  - **Board annotation color**: Choose your preferred color for board highlights
    and arrows
  - **Cross-device sync**: Preferences sync across devices for authenticated
    users
  - **Local storage fallback**: Non-authenticated users can still save
    preferences locally

### Progressive Web App (PWA)

- **Installable**: Add Relay to your home screen for a native app-like
  experience
- **Landscape lock**: Android phones automatically lock to landscape orientation
  for optimal viewing
- **Offline-ready**: Core functionality works offline once games are loaded

### Quick-open helpers (optional)

- **Bookmarklet**: one-click bookmark to open the current game in Relay (see
  [`user_scripts/bookmarklet.md`](user_scripts/bookmarklet.md))
- **TamperMonkey**: adds "Ellipviewer" buttons to bughouse games in chess.com
  game history (see
  [`user_scripts/ellipviewer_installation.md`](user_scripts/ellipviewer_installation.md))

---

## For Developers (setup, architecture, contributing)

### Tech stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** for styling
- **chess.js** for rules/legality and FEN state
- **chessboard.js** (with **jQuery**) for board rendering
- **Vitest** for unit tests + **Cypress Component Testing** for UI components

### Architecture map (where to look)

- **Local opening-explorer experiment**: `app/opening-explorer/page.tsx`,
  `app/components/opening-explorer/`. This is a separate one-board surface and
  does not share viewer replay, analysis, move-tree, or URL state.
- **Player Insights**: `app/player-insights/page.tsx`,
  `app/components/player-insights/`, and the checked static projection at
  `app/data/player-material-insights.json`. This route has no runtime data API.

- **Core bughouse rules / move application**: `app/utils/analysis/applyMove.ts`
- **Analysis tree + navigation + promotions/variations**:
  `app/components/useAnalysisState.ts`
- **Clock simulation + live replay primitives**:
  `app/utils/analysis/buildBughouseClockTimeline.ts`,
  `app/utils/analysis/liveReplay.ts`
- **Move ordering + chess.com ingestion**: `app/utils/moveOrdering.ts`,
  `app/chesscom_movelist_parse.ts`
- **Replay controller (imperative stepping + undo)**:
  `app/utils/replayController.ts`
- **Main UI**: `app/components/GameViewerPage.tsx`,
  `app/components/BughouseAnalysis.tsx`
- **Shared games**: `app/utils/sharedGamesService.ts`,
  `app/shared-games/SharedGamesPageClient.tsx`
- **User preferences**: `app/utils/userPreferencesService.ts`,
  `app/components/SettingsModal.tsx`
- **Authentication**: `app/auth/AuthProvider.tsx`, `app/auth/useAuth.ts`
- **Username service**: `app/utils/usernameService.ts`
- **Match discovery**: `app/utils/matchDiscovery.ts`,
  `app/components/MatchNavigation.tsx`

### Opening-explorer experiment

The opening explorer remains isolated from the two-board viewer and is now
available as a production trial at
[`/opening-explorer`](https://bughouse.aronteh.com/opening-explorer). It reads
only bounded, versioned responses through a same-origin proxy; the browser never
loads the packed artifact or receives the service credential.

For local development, run two processes: the Python loopback reader from the
sibling `bughouse-opening-explorer` repository, then this Next.js app pointed at
that service.

1. Start the opening service (from `bughouse-opening-explorer`):

```bash
cd ~/Desktop/Coding_Adventures/bughouse-opening-explorer

.venv/bin/python -m bughouse_explorer.opening.service artifacts/opening/full-post-qualification-20260802-v2-a --port 8765
```

Replace the second argument with whatever artifact you want to build the tree
on; keep `--port 8765` unless you also change `OPENING_EXPLORER_SERVICE_URL`
below.

1. Start this application (from `bughouse-chess`):

```bash
cd ~/Desktop/Coding_Adventures/bughouse/bughouse-chess

OPENING_EXPLORER_SERVICE_URL=http://127.0.0.1:8765 \
npm run dev
```

Visit `/opening-explorer` or use the `Opening explorer` sidebar icon. Route,
sidebar, and proxy are always available in local, Preview, and Production
builds; no availability feature flag is required.

The local Python reader is a separate process; `npm run dev` does not start it.
If the reader is absent, the always-present page shows a bounded unavailable
state and the proxy returns 503. On first visit the browser requests metadata,
then one root or deep-link neighborhood capped at 500 nodes/256 KiB by default;
it does not download or initialize the packed artifact in browser memory.

The hosted service origin, exact origin allowlist, timeout, and bearer token are
server-only `OPENING_EXPLORER_SERVICE_*` variables. Never expose them through a
`NEXT_PUBLIC_*` variable. Unknown proxy operations return not-found behavior;
unavailable upstream services return a bounded `503` response.

The full local scale-up is complete and documented in the sibling repository at
`bughouse-opening-explorer/docs/FULL_OPENING_TREE_SCALE_UP_RESULT_2026-08-04.md`.
The page now emits low-cardinality browser performance marks and the proxy adds
its upstream duration to `Server-Timing`. The 6,516,478-game full artifact has
not been uploaded; a protected Vercel Large Functions Preview and any later
Production switch remain separate approval gates.

Possible next moves are ordered by descending game support and use White-win,
draw, and Black-win bars. Use Up/Down to select a continuation, Right to play
it, and Left to return along the cached prefix. At desktop widths the board
expands beside a dedicated played-line move list; the far-right controls stack
the player filter, possible next moves, and instrumentation. The filter accepts
one corpus-backed player and a White/Black seat choice; autocomplete remains
visible while typing, and Apply stays disabled until the input exactly matches
an indexed username. A game ending at the current prefix appears as an
unclickable `-` row. Once a prefix contains exactly one game and one
continuation, that move becomes a link to the source game in Relay's Bughouse
analysis board and shows both players plus the result; keyboard navigation
deliberately stops at that boundary. The analysis link opens in a new tab. If the
packed terminal policy has already stopped materializing at the first global
support-one prefix, the same bounded metadata lookup appears as a `Game` source
row instead. The earlier bounded multi-game inspection panel is intentionally
omitted from the user-facing UI.

### Player Insights

`/player-insights` is an isolated, searchable host for insights about the
permanently tracked player cohort. Its first two chips show lifetime net
material and net material per analyzed game. The page follows the user's
Bughouse or Standard piece-value preference. Its Net and individual piece
columns are click-to-sort controls: the first click ranks the most won, and a
second click reverses toward the most lost. The Games column follows the same
interaction for the number of analyzed games. In the per-game view, each
piece's won, lost, and net figures use the same analyzed-game denominator as
the overall score.

The third chip, **Average King Height**, shows how far each player's king
reaches from its own back rank. Every player card includes a nullable weighted
average and an eight-bucket probability chart. **Average King Height** and
**Touchdowns** are separate sort toggles; activating the selected metric again
reverses its direction. An expandable, scroll-contained panel opens every
public game in which the player's king reached the opposite back rank in Relay's
Bughouse analysis board; the UI calls these rare games **touchdowns**. These
links open in a new tab. The minimum-games filter defaults to 1000
and accepts only non-negative integers. White and Black directions are
normalized before aggregation, and players with no analyzed games show an em
dash and remain last in average-height sorting when the minimum is cleared.
Desktop rows reserve a fixed-height, internally scrolling touchdown area so
expansion does not move the surrounding leaderboard; mobile cards continue to
expand naturally. Small mobile layouts hide both explanatory paragraphs and
use tighter header, navigation, search, sort, and filter spacing so the first
player arrives earlier.

The route imports `app/data/player-material-insights.json` at build time. The
current 1,013-player file is 194,309 bytes uncompressed and approximately 54 KB
with gzip. The 791,817-byte king-height projection is statically imported only
inside the lazy-loaded third insight, so it is not part of the initial material
view. The browser needs no SQLite reader, runtime database, route handler, or
opening-explorer service request. Material rows use a full desktop table and
compact five-piece ledgers on smaller screens; king height uses a purpose-built
responsive card chart.

The source of truth remains the checked material-insights SQLite artifact in the
sibling `bughouse-opening-explorer` repository. After building and validating a
future database, refresh this tracked frontend projection from that repository
with its recorded checksum:

```bash
.venv/bin/python scripts/export_player_insights.py \
  artifacts/insights/<snapshot>/player-insights.db \
  ../bughouse/bughouse-chess/app/data/player-material-insights.json \
  --database-sha256 <player-insights-db-sha256> \
  --replace

.venv/bin/python scripts/export_king_height_insights.py \
  artifacts/insights/<snapshot>/player-insights.db \
  ../bughouse/bughouse-chess/app/data/player-king-height-insights.json \
  --database-sha256 <player-insights-db-sha256> \
  --replace
```

The exporters read the database immutably, validate each projection's row
shape and invariants, and atomically replace the static JSON. Review the JSON
metadata and checksums, then run this repository's tests, lint, build, and
production-build browser checks before publication.

The sibling data repository owns the durable contract for adding other insight
shapes and refreshing them from later snapshots. See its
[`Player Insights development guide`](https://github.com/Ellipsoul/bughouse-opening-explorer/blob/main/docs/PLAYER_INSIGHTS_DEVELOPMENT_GUIDE.md)
and
[`reusable session prompt`](https://github.com/Ellipsoul/bughouse-opening-explorer/blob/main/docs/PLAYER_INSIGHTS_SESSION_PROMPT.md).

### Firebase (optional, for metrics + analytics + user features)

Relay supports:

- **Firestore** (Admin SDK) for:
  - A single global metric: **how many games were loaded**
  - **Shared games**: Public collection of games shared by users
  - **User preferences**: Per-user settings (board annotation color, etc.)
  - **Username reservations**: Unique username registry
  - **User shared games**: Index of games shared by each user
- **Firebase Analytics** (Web SDK) for basic interaction tracking (e.g. "Load
  Game" clicks)
- **Firebase Authentication** for Google sign-in

Privacy design:

- The browser does **not** talk to Firestore directly for most operations.
- The app uses server routes (e.g., `/api/metrics/game-load`) which
  increment/read counters stored at Firestore document `metrics/global`.
- The metric is intentionally anonymous and low-cardinality (no per-game IDs
  stored).
- Shared games are public and can be viewed by anyone, but only authenticated
  users can create them.
- User preferences are private and only accessible by the user who created them.

#### Firebase / Firestore setup (local + production)

1. Create a Firebase project
2. Enable Firestore (Native mode)
3. Enable **Firebase Analytics** for your web app (Project settings →
   Integrations → Google Analytics)
4. Create a **Service Account** and copy the JSON credentials
5. Register your web app in Firebase Console (Project settings → General → Your
   apps → Add app → Web)
6. Set these environment variables (recommended in `.env.local`):

**Server-side (Firestore Admin SDK):**

```bash
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"

# Important: keep the quotes and use \\n for newlines
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

**Client-side (Firebase Analytics + App Check):**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY="your-recaptcha-v3-site-key"
```

Security recommendation: you can keep Firestore rules fully locked down (deny
all). The server uses Firebase Admin SDK and bypasses rules.

#### Firestore indexes (programmatic configuration)

Relay keeps Firestore index definitions in `firestore.indexes.json` so indexes
can be deployed alongside rules with the Firebase CLI:

```bash
firebase deploy --only firestore:indexes
```

#### Firebase Authentication (optional, for user sign-in)

Relay supports **Google sign-in** via Firebase Authentication. When enabled,
users can sign in to unlock authenticated features like sharing games and
syncing preferences across devices.

**Setup steps:**

1. In Firebase Console, go to **Authentication → Sign-in method → Google** and
   enable it.
2. Set a **support email** for the Google provider.
3. Go to **Authentication → Settings → Authorized domains** and add:
   - `localhost` (for local development)
   - Your production domain (e.g. `bughouse.aronteh.com`)
4. Ensure your web app is registered (Project settings → General → Your apps →
   Web) and your `.env.local` contains the `NEXT_PUBLIC_FIREBASE_*` values
   listed above.

**No additional environment variables are needed** — Firebase Auth uses the same
client-side config (`NEXT_PUBLIC_FIREBASE_*`) already required for Analytics.

The authentication UI is accessible via the **Profile** button in the left
sidebar. Users can sign in with Google popup and sign out from the profile page.

#### Firestore Collections Structure

When using Firebase features, Relay creates the following Firestore structure:

- `metrics/global` - Global game load counter (server-only access)
- `sharedGames/{sharedId}` - Public shared games collection
  - `sharedGames/{sharedId}/games/{index}` - Game data subcollection
- `users/{userId}/userPreferences/settings` - User preferences (private)
- `users/{userId}/sharedGames/{sharedId}` - User's shared games index
- `usernames/{username}` - Username reservation registry

See `firestore.rules` for security rules that enforce privacy and access
control.

### Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Useful scripts

- `npm run lint`: TypeScript check + ESLint
- `npm run format`: ESLint auto-fix
- `npm run test:unit`: Vitest unit tests once
- `npm run test:component`: Cypress component tests headlessly
- `npm run fixtures:record`: record chess.com fixtures for tests

### Testing strategy

- **Unit tests (Vitest)** cover deterministic domain logic (move rules, clock
  simulation, parsing).
- **Component tests (Cypress)** cover UI components like promotion selection,
  variation selection, move tree rendering, and reserve interactions.

### Contributing

Contributions are welcome — especially around:

- bughouse edge cases / legality correctness
- UI/UX polish and accessibility
- performance improvements for large games
- more fixtures + regression tests for tricky chess.com payloads

If you’re adding new domain logic, prefer pure functions in `app/utils/**` and
accompany them with unit tests under `tests/unit/**`.
