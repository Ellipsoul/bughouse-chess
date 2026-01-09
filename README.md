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
- **Partner board auto-detection**
  - If chess.com provides `partnerGameId`, Relay uses it.
  - Otherwise, Relay probes nearby IDs to find the paired board.

### Replay the match (two boards, one timeline)

- **Two synchronized boards** (A and B) side-by-side.
- **Merged move timeline** ordered by timestamp so you can step through the
  match as it actually unfolded (including simultaneous-move quirks).
- **Clocks** shown per player (as provided by chess.com), synchronized to the
  current position.
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

If you’re playing a bughouse match consisting of multiple consecutive games,
Relay can help you **discover and step through subsequent games** with the same
four players and the same team pairings (rate-limited to be gentle to
chess.com).

### Quick-open helpers (optional)

- **Bookmarklet**: one-click bookmark to open the current game in Relay (see
  [`user_scripts/bookmarklet.md`](user_scripts/bookmarklet.md))
- **TamperMonkey**: adds “Ellipviewer” buttons to bughouse games in chess.com
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

### Firebase (optional, for metrics + analytics)

Relay supports:

- **Firestore** (Admin SDK) for a single global metric: **how many games were
  loaded**
- **Firebase Analytics** (Web SDK) for basic interaction tracking (e.g. “Load
  Game” clicks)

Privacy design:

- The browser does **not** talk to Firestore directly.
- The app uses a server route (`/api/metrics/game-load`) which increments/reads
  a counter stored at Firestore document `metrics/global`.
- The metric is intentionally anonymous and low-cardinality (no per-game IDs
  stored).

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

**Client-side (Firebase Analytics):**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"
```

Security recommendation: you can keep Firestore rules fully locked down (deny
all). The server uses Firebase Admin SDK and bypasses rules.

#### Firebase Authentication (optional, for user sign-in)

Relay supports **Google sign-in** via Firebase Authentication. When enabled,
users can sign in to unlock future authenticated features.

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
