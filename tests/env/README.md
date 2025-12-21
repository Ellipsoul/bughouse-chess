This directory is intentionally used as `envDir` for test runners.

Why it exists:
- Vite (and therefore Vitest and Cypress Component Testing) will, by default, attempt to read
  `.env*` files from the project root (including `.env.local`).
- In sandboxed/CI environments those files are often gitignored and may be unreadable to tooling.

We point test runners at this directory to keep tests deterministic and avoid accidental coupling
to developer-local secrets.


