# Development and documentation maintenance

## Local setup

Use Node.js 22.12+ or a compatible newer LTS for the current dependency set, plus
npm. From the repository root:

```bash
npm ci
npm run dev
```

The app runs at `http://localhost:3000`. Basic game loading uses server-side
Chess.com requests without Firebase credentials. Account and sharing features
need the Firebase setup in the [README](../README.md). Opening explorer needs a
separate service; Player Insights uses the checked-in JSON projections.

For a local production check, run `npm run build` then `npm start`. The build
uses `next/font` Google font loading, so font-host access can be required. The
opening proxy rejects loopback HTTP under production `NODE_ENV`; use the hosted
configuration in [data and services](data-and-services.md) to exercise it there.

## Checks

| Command | Scope |
| --- | --- |
| `npm run lint` | TypeScript (`tsc --noEmit`) followed by ESLint |
| `npm run format` | ESLint autofix; modifies files |
| `npm run test:unit` | Vitest unit, hook, and route tests |
| `npm run test:unit:watch` | Interactive Vitest watch mode |
| `npm run test:unit:coverage` | V8 coverage report |
| `npm run test:component` | Cypress component suite with owned Firebase emulators |
| `npm run test:e2e` | Cypress E2E suite with owned emulators and Next.js dev server |
| `npm test` | Unit and component suites |
| `npm run test:all` | Unit, component, and E2E suites |

The `:open` variants of the Cypress commands open its interactive runner. Cypress
also requires its platform binary and OS browser dependencies. The emulator runner
uses Firebase CLI (included in dev dependencies), a supported Java runtime, Bash,
`curl`, and `lsof`. Emulator ports 4000, 4400, 4500, 8080, 9099, and 9150 must be
free; E2E also needs 3000. It refuses existing listeners and stops only the processes
it starts. Logs remain in the run-specific temporary directory printed at exit.

Vitest and Cypress component Vite configurations use `tests/env` to avoid loading
root `.env` files. E2E explicitly passes demo Firebase settings to Next.js. Its
Node fetch shim serves recorded Chess.com responses, with no live Chess.com
fallback. Browser intercepts cannot see server-action fetches; use the
`chesscomRequests` task for those assertions. See [test environment notes](../tests/env/README.md).

The pre-commit hook runs lint-staged autofixes and unit tests. The pre-push hook
runs lint/type checking, unit tests, Cypress verification, component tests, and
E2E tests. A production build is a separate check, not part of that hook.

## Fixtures and helper scripts

```bash
npm run fixtures:record -- <gameId> [otherGameId]
npm run fixtures:record:match -- <gameId>
npm run fixtures:record:match -- <gameId> --partner-only <username1> <username2>
```

These are acquisition commands: they access live Chess.com and write tracked JSON
under `tests/fixtures/chesscom/`. Review generated payloads and match indexes before
committing. `scripts/findCompleteMatch.js` is a separate live discovery helper;
its own header documents usage. Neither acquisition nor database migrations are
required for an ordinary unit test run.

The optional [bookmarklet](../user_scripts/bookmarklet.md) and
[userscript](../user_scripts/ellipviewer_installation.md) open Chess.com games in
Relay. They use the supported legacy `gameid` query spelling. The userscript relies
on Chess.com DOM heuristics and is separate from application runtime code.

## Updating documentation alongside code

Use JSDoc for exported domain functions, data contracts, and non-obvious component
or service boundaries. Explain units, indexing, nullable/failure results, mutation
or aliasing, side effects, and preconditions where they matter. TypeScript already
expresses most parameter types; avoid restating them without useful context.

Keep ordinary inline comments for reasoning that is local to an implementation:
why a timestamp is clamped, why a board swap is display-only, or why a request is
bounded. Update obsolete claims instead of adding contradictory comments nearby.
Do not change behavior, lint directives, or type-check directives during a purely
informational edit.

For documentation-only changes, run lint/type checking and check the diff. Comparing
TypeScript syntax trees or emitted JavaScript with comments removed can confirm
that executable source is unchanged. Run relevant existing tests for documented
contracts; there is no need to add tests that merely assert comment wording.
