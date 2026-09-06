This directory is intentionally used as `envDir` for test runners.

Why it exists:
- Vite (and therefore Vitest and Cypress Component Testing) will, by default, attempt to read
  `.env*` files from the project root (including `.env.local`).
- In sandboxed/CI environments those files are often gitignored and may be unreadable to tooling.

We point test runners at this directory to keep tests deterministic and avoid accidental coupling
to developer-local secrets.


Cypress E2E runs (`npm run test:e2e`) start an owned Firebase demo stack and pass
its settings to Next.js explicitly. Firebase CLI and Java must be available on
PATH; ports 3000, 4000, 4400, 4500, 8080, 9099 and 9150 must be free. The runner
refuses to reuse existing servers and stops only its own services on exit.

Chess.com server-action requests use `tests/support/chesscom-fixtures.mjs`, loaded
only into the E2E Next.js process. It serves the recorded games and derives a
monthly archive from `match-index.json`; it never falls through to live Chess.com.
The `chesscomRequests` Cypress task reads the server's request log, since browser
intercepts cannot observe server-action fetches. Service logs remain in the
run-specific temporary directory printed at exit.

Vitest's shared setup explicitly binds browser storage to the current JSDOM
instance. This avoids Node's native Web Storage globals shadowing browser storage
in newer Node releases, while leaving Node-only route tests unchanged.
