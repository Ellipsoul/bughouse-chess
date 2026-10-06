# Data, service boundaries, and maintenance

## Firebase access

Browser features use `app/utils/platform/firebaseClient.ts` and the Web SDK.
Server reads and metrics use the `server-only` Admin bootstrap. These are separate
access paths: Admin bypasses Firestore rules, while browser requests must satisfy
`firestore.rules`. A deny-all rules deployment breaks browser sharing and preferences.

| Path | Purpose and access |
| --- | --- |
| `metrics/global` | Anonymous global load count; Admin access through the public metrics route |
| `sharedGames/{id}` | Public schema-v2 summary, ownership, description, and metadata |
| `sharedGames/{id}/games/{index}` | Public source payloads, ordered by numeric `index` field |
| `users/{uid}` | Owner-readable permanent username record |
| `usernames/{username}` | Authenticated availability reads and permanent reservations |
| `users/{uid}/sharedGames/{id}` | Owner's share index and content hash |
| `users/{uid}/userPreferences/settings` | Owner's annotation color, auto-advance, and piece-value preset |

Sharing UI requires sign-in plus username reservation. The rules helper for full
authentication checks that the user document exists. Shared parent documents are
immutable for clients, except owner deletion. Current game-subdocument create
rules check full authentication and shape, but do not check parent ownership;
parent-write validation must not be described as authorizing independent writes.

A single-game share batches its parent, user index, and payload atomically.
Match/partner-series sharing commits parent/index first, then payload chunks of
100 games. Failure can leave a partial share; there is no whole-upload rollback.
Callbacks report completed chunks. The `bh2_` SHA-256 content hash normalizes board
pairs, game order, and selected partner names, and includes user and content type.
It is a client-side duplicate check, not an authorization or transactional uniqueness
guarantee. Descriptions and analysis variations are not part of its identity.

Preferences read local storage first and may hydrate from Firestore. Annotation
color has a special rule: a locally stored default color still permits a remote
lookup. Explicit valid auto-advance and piece-value preferences win locally.
Piece-value writes notify same-tab subscribers in addition to cross-tab storage
events. Annotations themselves are transient viewer state, not saved preferences.

## Configuration

See the [README Firebase setup](../README.md#firebase--firestore-setup-local--production)
for the client config fields and server service-account variables. Admin normally
requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`;
escaped key newlines are normalized. Tests can instead use `FIRESTORE_EMULATOR_HOST`
with a `demo-` project ID and no service-account key.

Browser emulator selectors are `NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST` and
`NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST`, both `host:port` without a URL scheme.
The test runner supplies matching demo project settings. Public Firebase config
identifies the web app; server credentials must remain server-only.
`NEXT_PUBLIC_SITE_URL` controls the public origin used in metadata and share URLs.

`/api/metrics/game-load` accepts public GET and POST requests. POST expects a
nonempty, trimmed `gameId` of at most 128 characters, but does not store that ID
or verify auth/App Check. Invalid bodies return 400. Firestore failures return
200 with `gamesLoaded: 0`, so a zero response is not a storage-health assertion.

## Opening service

The browser calls `/api/opening-explorer/api/...`; the route forwards only metadata,
player-prefix, node-neighborhood, node-games, and edge-games GET paths. The service
and its packed artifacts belong to the sibling `bughouse-opening-explorer` project.
The browser receives bounded versioned responses, never the packed artifact or token.

| Server variable | Meaning |
| --- | --- |
| `OPENING_EXPLORER_SERVICE_URL` | Service origin; defaults to `http://127.0.0.1:8765` |
| `OPENING_EXPLORER_SERVICE_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins permitted for hosted service access |
| `OPENING_EXPLORER_SERVICE_TOKEN` | Required bearer credential for hosted access |
| `OPENING_EXPLORER_SERVICE_TIMEOUT_MS` | Integer 100–60,000 ms; default 45,000 |

Loopback HTTP is allowed only outside production. Hosted origins require HTTPS,
allowlisting, and a token. Unknown paths return 404; configuration or transport
failures return bounded 503 JSON. Upstream responses preserve selected cache headers
and include timing. The browser API validates dataset identity and response shape;
stale versions and corrupt payloads are distinct from an unavailable service.

## Player Insights projections

`app/data/player-material-insights.json` supplies the initial view. King-height,
drop-heatmap, and material-game-high projections load through separate data wrapper
components. They are build assets rather than Firestore records or runtime API reads.

Material piece tuples are `[won, lost]`, aligned with `pieceOrder` and preset
weights. King-height buckets use analyzed-game counts. Drop arrays are
`[white, black][piece][square]`; combined mode reflects Black's ranks while keeping
files unchanged. Game highs store doubled integer `netMaterialX2` scores and separate
precomputed lists for each preset/direction. Do not recompute one preset's top three
by rescoring another preset's retained games.

The sibling repository owns acquisition, SQLite snapshots, analyzers, validation,
and atomic projection exports. Use the refresh/export commands in the
[README](../README.md#player-insights), review metadata/checksums, then validate the
frontend. Do not hand-edit projection numbers. Snapshot sizes and dataset IDs in
release notes are dated observations, not checks of the currently deployed service.

## Social previews

`/api/social-preview` normalizes bounded game/share parameters and reconstructs both
boards through the replay controller. It rejects timelines over 10,000 moves.
Direct reads use fixed Chess.com endpoints with six-second request timeouts;
saved shares read only the public parent and first indexed game via Admin.
Source results use a five-minute revalidation interval. Images cache for five
minutes in browsers and one hour on a CDN; fallback artwork caches for one minute.

The renderer uses bundled sprites under `public/preview-pieces`, included in output
tracing by `next.config.ts`. It buffers image generation so rendering failures can
return the branded fallback. This bundled artwork is separate from interactive and
static insight boards that use external chessboardjs sprites.

## Database maintenance scripts

All three commands below load `.env.local`, use Admin credentials, and default to
**dry run**. They still read the selected database. `DRY_RUN=false` enables writes;
confirm the intended project and review dry-run output before applying a migration.

| Command | Effect when writes are enabled |
| --- | --- |
| `npm run migration:shared-games-v2` | Move legacy inline `gameData` to indexed subdocuments, set schema 2, remove inline data |
| `npm run migration:shared-game-hashes` | Compute and merge content hashes into user share indexes (including existing hashes) |
| `npm run migration:shared-game-hashes-sha256` | Recompute current SHA-256 hashes and update differing indexes |

These are maintenance tools, not app startup steps. Their source headers describe
prerequisites and write behavior. Deploy rules/indexes using the checked-in
`firebase.json`, `firestore.rules`, and `firestore.indexes.json`; emulator success
does not establish production credentials or deployed rule/index state.
