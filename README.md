# Bughouse Chess Viewer

**Deployed at https://bughouse.aronteh.com/**

Welcome! This is a web app for **replaying and analyzing bughouse games from
chess.com**.

It loads both boards of a bughouse match (the “partner” game), merges the moves
into a single timeline, and gives you an interactive two-board analysis UI with
**drops**, **variations**, and **keyboard navigation**.

## Key Features

### Load Bughouse games from chess.com

- **Load by game ID**: paste a chess.com _live game ID_ and the app fetches the
  game.
- **Auto-detect the partner board**: if chess.com provides a `partnerGameId`, we
  use it; otherwise the app probes nearby IDs to find the paired bughouse board.
- **Open games via URL**: `https://bughouse.aronteh.com/?gameId=159878252255`

### Replay a full two-board bughouse match

- **Two synchronized boards** (A and B) rendered side-by-side.
- **Merged move timeline**: moves from both boards are ordered by timestamp so
  you can step through the match as it actually unfolded.
- **Clocks**: shows remaining time snapshots per player (as provided by
  chess.com), synchronized with the current position.
- **Responsive layout**: boards resize to fit the available width.

### Analyze positions interactively (like an analysis board, but bughouse-aware)

- **Make moves directly on the board** via drag-and-drop.
- **Bughouse drops**:
  - Click a reserve piece to “arm” a drop, then click a target square.
  - Or drag reserve pieces onto the board.
- **Promotion handling**: when a move needs promotion, the UI asks you to pick a
  piece.
- **Bughouse reserves update correctly**: captures on one board feed the
  partner’s reserve for later drops.

### Explore and manage variations

- **Branching analysis tree**: play alternative lines from any position.
- **Variation selector**: when a node has multiple continuations, stepping
  forward can open a selector.
- **Move list with inline variations**: the mainline stays in a 4-column layout
  (A/B, white/black), and variations are displayed beneath the relevant move.
- **Context menu tools**:
  - **Promote variation** (make a side line the mainline).
  - **Delete from here** (delete all continuations after a node).

### Keyboard + quality-of-life controls

- **Arrow keys**: navigate moves (and variations when applicable).
- **Up/Down**: jump to start/end of the current line.
- **Flip boards**: press **f** (or use the flip button).
- **Toasts**: clear feedback for load states, illegal moves, promotions, etc.

## Technologies Used

### Frameworks & UI

- **Next.js** (App Router) for the application framework.
- **React** for the interactive UI.
- **TypeScript** for type safety.
- **Tailwind CSS** for styling.
- **lucide-react** for icons.
- **react-hot-toast** for notifications.

### Firebase (Firestore metrics + Analytics)

This project uses **Firestore** (via **Firebase Admin SDK**) to store a simple
global metric: **how many games have been loaded**.

- The browser **does not** talk to Firestore directly.
- The app calls a server endpoint (`/api/metrics/game-load`) which
  increments/reads a counter stored at Firestore document `metrics/global`.

This project also uses **Firebase Analytics** (via **Firebase Web SDK**) to track
user interactions:

- **Load Game button clicks**: tracked with event `load_game_button_click`
- Firebase Analytics has built-in throttling to prevent excessive event logging
- Analytics is initialized automatically on the client side and gracefully handles
  cases where it's not configured or not supported

### Chess / bughouse domain logic

- **chess.js** for rules, legal move validation, check/checkmate detection, and
  FEN state.
- **Bughouse move + reserve rules** implemented in app utilities:
  - Drops are represented as `P@e4` (optionally suffixed with `+/#`).
  - Captures feed the partner board’s reserve.
  - Promotions are tracked (including visual marking of promoted squares).

### Board rendering

- **chessboard.js** for board UI, integrated via a small client wrapper.
- **jQuery** is used because chessboard.js expects it.

### Data ingestion

- The app fetches chess.com live game payloads from
  `https://www.chess.com/callback/live/game/<gameId>`.
- chess.com’s compressed `moveList` format is parsed and normalized before being
  merged into a single bughouse timeline.

### Tooling

- **ESLint** + **TypeScript** typechecking via `npm run lint`.
- **@vercel/analytics** for deployment analytics.

## Development

### Prerequisites

- Node.js + npm

### Firebase / Firestore setup (local + production)

1. Create a Firebase project
2. Enable Firestore (Native mode)
3. Enable **Firebase Analytics** for your web app (Project settings → Integrations → Google Analytics)
4. Create a **Service Account** (Project settings → Service accounts) and copy
   the JSON credentials.
5. Register your web app in Firebase Console (Project settings → General → Your apps → Add app → Web)
6. Set these environment variables (recommended in `.env.local` for local dev):

**Server-side (Firestore Admin SDK):**

```bash
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com"

# Important: keep the quotes and use \\n for newlines
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

**Client-side (Firebase Analytics):**

All client-side variables must be prefixed with `NEXT_PUBLIC_` to be accessible in the browser.
These values can be found in your Firebase Console under Project Settings → General → Your apps → Web app config:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:abcdef123456"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"  # Required for Analytics
```

The `measurementId` (also called `measurement_id` in some Firebase docs) is automatically created when you enable Analytics for your web app. It typically starts with `G-`.

Security recommendation: you can keep Firestore security rules fully locked down
(deny all). The server uses Firebase Admin SDK and bypasses rules.

### Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

### Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run start`: run the production server
- `npm run lint`: TypeScript check + ESLint
- `npm run format`: ESLint auto-fix
- `npm run test`: run unit tests (Vitest) + Cypress component tests
- `npm run test:unit`: run unit tests once
- `npm run test:watch`: run unit tests in watch mode
- `npm run test:coverage`: run unit tests with coverage report
- `npm run test:component`: run Cypress Component Tests headlessly
- `npm run test:component:open`: open Cypress Component Testing UI
- `npm run fixtures:record`: record chess.com game fixtures for testing

## Testing

This project uses a comprehensive testing strategy with **Vitest** for unit
tests and **Cypress Component Testing** for UI component tests.

### Unit Tests (Vitest)

Unit tests cover all deterministic bughouse domain logic:

- **Bughouse move rules engine** (`app/utils/analysis/applyMove.ts`)
  - Normal moves, drops, promotions, captures
  - Reserve management and partner board feeding
  - Turn enforcement and legality validation
- **Bughouse checkmate detection** (`app/utils/bughouseCheckmate.ts`)
  - Blockable vs unblockable checkmates
  - Double-check and knight-check handling
- **Clock timeline building**
  (`app/utils/analysis/buildBughouseClockTimeline.ts`)
  - Two-clock simulation correctness
  - Non-monotonic timestamp handling
- **Game data processing** (`app/utils/moveOrdering.ts`)
  - Player color mapping
  - Move merging and chronological ordering
- **Move conversion** (`app/utils/moveConverter.ts`)
  - Chess.com notation normalization
- **Analysis state management** (`app/components/useAnalysisState.ts`)
  - Tree navigation, variations, promotions
  - Clock anchor logic

Run unit tests:

```bash
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
```

Coverage reports are generated in `coverage/` directory. We aim for near-100%
coverage on domain logic.

### Component Tests (Cypress)

Component tests verify UI component behavior:

- **PromotionPicker**: promotion selection UI
- **VariationSelector**: branch selection dialog
- **MoveTree**: parenthesized variation rendering
- **MoveListWithVariations**: 4-column move list with variations
- **PieceReserveVertical**: reserve piece display and interaction

Run component tests:

```bash
npm run cy:component        # Open Cypress UI
npm run cy:component:run    # Run headlessly
```

### Test Fixtures

Chess.com game data is recorded as fixtures to avoid live API calls during
tests. Fixtures are stored in `tests/fixtures/chesscom/`.

To record new fixtures:

```bash
npm run fixtures:record
# Or with specific game IDs:
tsx scripts/recordChessComFixtures.ts <gameId1> <gameId2> ...
```

The script automatically finds and records partner games when available.

### Git Hooks (Husky)

Quality gates are enforced via Git hooks:

- **pre-commit**: Runs `lint-staged` to auto-fix linting issues on staged files
- **pre-push**: Runs full test suite (`lint` + `test` + `cy:component:run`)

These hooks ensure code quality before commits and pushes.
