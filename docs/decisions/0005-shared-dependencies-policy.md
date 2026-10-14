# 0005 — Shared dependencies policy

- Status: accepted
- Date: 2026-10-14
- Iteration: 01

## Context
Libraries that keep module-level state (React and its renderer, later router, query client,
store, i18n) must exist once per page. Remotes are deployed independently, so the version each
app was built with can differ at runtime. Webpack's automatic `requiredVersion` inference is not
reliable in this repo: with pnpm catalogs `package.json` contains `"catalog:"`, and requests coming
from inside a package (e.g. `react-dom/client` → `react-dom`) infer `*`.

## Options
1. **`singleton: true` + explicit `requiredVersion` (`^installed`) + `strictVersion: false`** — always one
   instance; a version outside the range logs a console warning and the app keeps working.
2. **`singleton: true` + `strictVersion: true`** — mismatch throws `Unsatisfied version … of shared
   singleton module …` when the consumer loads; without an error boundary the whole host goes blank.
3. **Non-singleton (default)** — every consumer gets the highest version satisfying its range; when none
   satisfies, a strict consume falls back to the app's own bundled copy → two React copies →
   "Invalid hook call".

## Decision
Option 1 for `react` and `react-dom`, and for every stateful library added later (SPEC section 7).
- `requiredVersion` is taken from the installed package (`require('react/package.json').version`) as a
  caret range, written explicitly in each `webpack.config.js`.
- All apps get the same version at build time through the pnpm catalog, so a mismatch can only appear
  when remotes are deployed at different times; then a warning is preferable to a broken page.
- Major upgrades of a singleton are coordinated: the host is upgraded first, remotes follow.

## Consequences
- A version mismatch is visible only in the console. It must be watched in dev and later reported to
  observability (iteration 14).
- `strictVersion: true` stays an option for libraries where running a wrong version is worse than not
  rendering, once error boundaries per remote exist (iteration 09).
