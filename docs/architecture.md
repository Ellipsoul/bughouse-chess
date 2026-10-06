# Architecture and domain contracts

Relay is a Next.js App Router application. The two-board viewer, opening explorer,
and Player Insights have separate state models. Shared presentation does not imply
shared navigation or game state.

## Source map

| Area | Entry points and responsibilities |
| --- | --- |
| App shell | `app/layout.tsx`, `app/providers.tsx`, `app/components/layout/`: metadata, providers, sidebar, and responsive shell |
| Viewer | `app/page.tsx`, `app/components/viewer/GameViewerPage.tsx`: load/URL state, discovery, sharing, and viewer sessions |
| Analysis UI | `app/components/viewer/BughouseAnalysis.tsx`, `app/components/moves/`: interactive positions, tree editing, move list, playback controls |
| Board UI | `app/components/board/`: chessboard.js integration, reserves, promotion picker, material overlays, and static boards |
| Ingestion | `app/actions.ts`, `app/chesscom_movelist_parse.ts`, `app/utils/board/moveOrdering.ts`: server fetches, compressed moves, combined timeline |
| Rules and replay | `app/utils/analysis/`, `app/utils/replay/`, `app/utils/board/`: move validation, clocks, reserves, annotations, orientation, replay history |
| Match discovery | `app/utils/discovery/`, `app/components/match/`, `app/types/match.ts`: archive scanning and match/partner-series navigation |
| Accounts | `app/auth/`, `app/profile/`, `app/utils/preferences/`: auth adapter/context, permanent username, preferences |
| Sharing | `app/utils/shared-games/`, `app/components/shared/`, `app/shared-games/`, `app/types/sharedGame.ts`: persisted shares, summaries, filtering, deduplication |
| Platform | `app/utils/platform/`: Firebase bootstraps, analytics, anonymous metrics, viewport/PWA helpers, metadata |
| Opening explorer | `app/components/opening-explorer/`, `app/api/opening-explorer/[...path]/route.ts`: versioned graph navigation and server proxy |
| Player Insights | `app/components/player-insights/`, `app/data/`: checked projections, ranking/aggregation, lazy views |
| Social previews | `app/api/social-preview/route.ts`, `app/utils/social-preview/`: bounded source loading, replay, PNG rendering |
| Maintenance | `scripts/`, `tests/`, `cypress/`, `user_scripts/`: migrations, fixture acquisition, checks, and optional Chess.com helpers |

## From a Chess.com game to a position

1. Server actions fetch the original board and locate its partner. The interactive
   viewer can probe nearby IDs if an explicit partner ID is absent. A normal 404
   becomes `null`; other fetch failures can throw.
2. `processGameData` decodes compressed moves, resolves player colors from payload
   color fields, and merges boards into `ProcessedGameData.combinedMoves`.
3. The interactive analysis hook builds a tree of position snapshots. The imperative
   `BughouseReplayController` maintains mutable chess.js boards plus undo snapshots;
   social previews also use this controller.
4. Presentation derives boards, reserves, move lists, and clocks from these models.
   The analysis cursor may enter a variation while its clock anchor stays on the
   most recently visited mainline node.

Board A is the original game and B is its partner. Partner teams cross colors:
A White partners B Black, and A Black partners B White. Left/right swapping and
board flipping are presentation choices; they must not rename logical board IDs,
reserve ownership, annotations, or move identities. `viewerOrientationStore.tsx`
is scoped to a viewer session.

## Time and indexing

- Raw Chess.com `moveTimestamps` represent remaining clock time in deciseconds.
  Ingestion consumes `baseTime1` directly in that unit and reconstructs elapsed
  timestamps, multiplying the seconds-based increment by 10.
- Combined move timestamps and simulated clocks use **deciseconds**, not milliseconds.
  The global clock builder runs one clock on each board simultaneously. It currently
  does not add increment after moves and clamps regressing/invalid timing.
- Move-list durations measure the gap since the previous move on the **same** board.
  Global playback gaps measure consecutive moves on **either** board.
- URL `ply=N` means N combined half-moves have been applied; zero is the start.
  The replay controller's move index is zero-based with `-1` at the start, so the
  preview seeks to `ply - 1`.
- Equal timestamps initially prefer A. Analysis import has special handling for
  simultaneous cross-board moves near checkmate; ordering is not always evidence
  that one real-world event preceded another.

## Move application and transient state

`validateAndApplyBughouseHalfMove` returns an `ok`, `error`, or `needs_promotion`
result and works on snapshots. Captures feed the opposite-color partner reserve;
drops consume the moving side's reserve. Promoted-square tracking is necessary
because capturing a promoted piece supplies a pawn. chess.js handles ordinary
moves, while bughouse helpers handle drops and reserve-aware checkmate.

Capture material is a signed **capture ledger**, not the current value of pieces
on a board or in a reserve. Captures credit the capturer and debit the opponent
on that board; drops do not change it. Bughouse weights are 1.5/3/3/4/7 for
pawn/knight/bishop/rook/queen; Standard weights are 1/3/3/5/9.

Analysis trees store positions at nodes and move identities on incoming edges.
Children have stable IDs and one optional mainline continuation. Treat snapshots
and returned analysis state as immutable. The replay controller has a separate
mutation/history model and copies caller moves before normalizing SAN.

Annotations are in-memory maps keyed by logical board and full FEN, with `start`
as an empty-FEN sentinel. They are not persisted to Firestore. Shared game payloads
store source games rather than the current analysis tree or annotations.

## URL and view boundaries

The viewer accepts `gameId`, legacy `gameid`, `sharedId`, and optional `ply`.
New loads canonicalize `gameId`; match navigation keeps a saved share's URL context.
Social previews prioritize shares and use the first indexed game of a saved match.
Direct social previews require an explicit partner ID and do not use adjacent-ID
probing. Without a preview ply, the image shows the final position.

Opening-explorer placement nodes are distinct from rules-state occurrences.
A placement alone does not encode side to move, castling, or en-passant rights;
navigation must use state IDs. Structural graph data is dataset-specific, while
support/result overlays are also filter-specific. The cache pins the played line,
evicts unpinned states by recency, and marks surviving parents as frontiers when a
child is evicted. All-pinned states may exceed its nominal limit.

Player Insights imports static JSON; it does not query the opening service or a
runtime database. Non-material views lazy-load their projections. Their rank
contracts differ intentionally in the current implementation:

| Leaderboard | When ranks are assigned |
| --- | --- |
| Material | Before name search and pagination |
| King height | After minimum-games filtering, before name search and pagination |
| Material game highs | Before minimum-games filtering, name search, and pagination |

Ties use username ordering and missing scores remain last. Leaderboard functions
expect checked projection shapes and positive integer page sizes. Drop-map
probabilities use drops of the active piece as denominator; they are not per-game
rates. Combined color reflects Black's ranks only, preserving files. Source arrays
reused by derived rows must remain read-only.

See [data and services](data-and-services.md) for persistence contracts and
[development](development.md) for the test and maintenance workflow.
