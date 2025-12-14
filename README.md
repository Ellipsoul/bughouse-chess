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
- **Flip boards**: press **F** (or use the flip button).
- **Toasts**: clear feedback for load states, illegal moves, promotions, etc.

## Technologies Used

### Frameworks & UI

- **Next.js** (App Router) for the application framework.
- **React** for the interactive UI.
- **TypeScript** for type safety.
- **Tailwind CSS** for styling.
- **lucide-react** for icons.
- **react-hot-toast** for notifications.

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
