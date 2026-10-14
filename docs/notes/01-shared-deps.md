# 01 — Shared dependencies and versioning

> Challenge: #2 · Tag: `iter-01-done`

## Problem
Every micro-frontend is built separately and bundles its own dependencies. Libraries with
module-level state (React, router, query client, store, i18n) break when two copies run on one page.
With independent deploys, apps also run with different versions of the same library, so the runtime
has to choose one — and someone has to decide what happens when the choice does not fit.

## Solution
- `shared` in shell, catalog and cart:
  ```js
  const reactVersion = require('react/package.json').version;
  // …
  shared: {
    react: { singleton: true, requiredVersion: `^${reactVersion}`, strictVersion: false },
    'react-dom': { singleton: true, requiredVersion: `^${reactDomVersion}`, strictVersion: false },
  },
  ```
- pnpm catalog in `pnpm-workspace.yaml`; apps use `"react": "catalog:"` (also for the build toolchain).
- Dev-only `window.__mfDebug()` in shell (`apps/shell/src/debug/mf-debug.ts`): `console.table` of the share
  scope. Loaded through `import()` behind `process.env.NODE_ENV !== 'production'`, so it is not in the
  production build (verified: no `__mfDebug` in `apps/shell/dist`).
- Policy: [ADR 0005](../decisions/0005-shared-dependencies-policy.md), SPEC section 7.

Result in the shell (`__mfDebug()`): one row per package — `react 19.3.0` and `react-dom 19.3.0`,
`providedBy: shell`, `loaded: true`. Build log: every app consumes `react@^19.3.0 (singleton)` and
`react-dom@^19.3.0 (singleton)` — one consume per package.

## How it works

### Share scope
A plain object shared by all containers on the page: `scope[package][version] = { get, from, eager, loaded }`.
- The host fills it in `__webpack_init_sharing__('default')` with its own shared modules.
- Every remote container adds its own in `container.init(scope)` (the `init` from iteration 00).
- One key per **version**: if two apps provide the same version, the entry is kept unless it is not yet
  loaded and the newcomer wins the tie (an eager entry wins; otherwise the greater `uniqueName` wins).
  That is why all three apps provide `19.3.0` but the table shows only `shell`.
- `from` is the provider's `output.uniqueName`; `loaded` becomes `1` once some app consumed that version.
- `__webpack_share_scopes__` exists only inside the bundle (webpack rewrites it), not on `window`; hence
  the helper. Its webpack typing (`webpack/module.d.ts`) misses the version level, so the helper declares
  its own type.

### How a consumer picks a version (webpack runtime, `ConsumeSharedRuntimeModule`)
| Config | Picks | If the pick does not satisfy `requiredVersion` |
|---|---|---|
| non-singleton, `strictVersion` (default when the app bundles a fallback) | highest version that satisfies the range | its **own bundled copy** (fallback) |
| non-singleton, `strictVersion: false` | highest satisfying | warning, then highest version overall |
| `singleton` (our choice) | the version **already loaded**, otherwise the highest | warning `Unsatisfied version …` |
| `singleton` + `strictVersion: true` | same | throws the same message |

Key point: a singleton does not use `requiredVersion` to choose — it only checks it. Usually the host
loads React first, so the host's version wins even if a remote ships a newer one.

### Where `requiredVersion` comes from
If not set, webpack reads it from the `package.json` closest to the **module that makes the import**:
- our `src/*` with `"react": "catalog:"` → not a semver range → `*` (seen as `react@*` in the shell build);
- `react-dom/client` importing `react-dom` from inside the package → no self-dependency → `react-dom@*`
  (the open question from iteration 00);
- `react-dom` importing `react` → `peerDependencies` of react-dom → `^19.3.0`.

So one package got up to three different ranges. An explicit `requiredVersion` replaces all of them.

### Deep imports are separate shared keys
`react/jsx-runtime` (`react/jsx-dev-runtime` in dev) and `react-dom/client` are not matched by the `react` /
`react-dom` keys, so every app ships its own copy (cart's `jsx-dev-runtime` chunk is loaded from `:3002`
inside the shell). This is fine: the production jsx-runtime does not import React at all and creates elements
tagged with `Symbol.for(...)`, which is the same across copies; the dev runtime imports `react`, which goes
through the singleton. `react-dom/client` is used only by the app that calls `createRoot` (the shell when
hosted) and reaches `react-dom` through the share scope. Decision: do not share them.

## What can go wrong

### 1. `react` is not shared by a remote that uses hooks
Checked with a temporary `shared: {}` and `useState` in `CartWidget`.
- **Symptom:** the whole shell page is blank; console:
  `Invalid hook call. Hooks can only be called inside of the body of a function component. …
  3. You might have more than one copy of React in the same app` followed by
  `Uncaught TypeError: Cannot read properties of null (reading 'useState')`.
  Standalone cart works.
- **Root cause:** the shell's `react-dom` renders the component and sets the current hooks dispatcher
  on the shell's React. Cart's code calls `useState` on its own React copy, whose dispatcher is `null`.
- **Fix:** share `react` and `react-dom` as `singleton` in every app. Components without hooks would
  "work" with two copies, which hides the problem until the first hook.

### 2. Apps have different React versions
Checked with cart declaring `requiredVersion: '~19.2.0'` while 19.3.0 is provided.
- **Symptom, singleton + `strictVersion: false`:** page works, console warning
  `Unsatisfied version 19.3.0 from shell of shared singleton module react (required ~19.2.0)`.
- **Symptom, singleton + `strictVersion: true`:** `Uncaught Error: Unsatisfied version 19.3.0 from shell of
  shared singleton module react (required ~19.2.0)`; the whole shell is blank (no error boundary yet).
- **Symptom, non-singleton (from the runtime algorithm, not run):** if cart's range accepts the host's version
  (`^19.2.0`), cart silently uses the highest one; if not (`~19.2.0`), cart falls back to its own copy →
  two Reacts → problem 1.
- **Root cause:** remotes are built and deployed at different times; the runtime can load only one singleton.
- **Fix:** singleton + explicit range + warning (ADR 0005); same version at build time via the pnpm catalog;
  coordinated major upgrades (host first); `strictVersion: true` only behind an error boundary (iteration 09).

### 3. No async bootstrap
Checked with cart's `src/index.ts` changed to `import './bootstrap'`.
- **Symptom:** standalone cart (`:3002`) is blank: `Uncaught Error: Shared module is not available for eager
  consumption: webpack/sharing/consume/default/react/react`. **The shell still works**: it loads only
  cart's `remoteEntry.js` and exposed chunks, never cart's `main.js`, so this bug is easy to miss.
- **Root cause:** a shared module is resolved asynchronously (the share scope must be filled and a version
  chosen first). A synchronous import of `react` in the entry chunk needs it before that happens.
- **Fixes:**
  - async bootstrap (`index.ts` → `import('./bootstrap')`): webpack loads the shared modules while
    loading the bootstrap chunk — chosen;
  - `eager: true`: the library goes into the initial chunk and is available synchronously, but it is
    always bundled (bigger entry), and the app consumes its own version before other containers register,
    so version negotiation for that package is effectively lost.

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| singleton + warn (chosen) | one instance; app keeps working on mismatch | mismatch visible only in console |
| singleton + `strictVersion: true` | wrong version never runs | a remote with a newer range takes the page down without an error boundary |
| non-singleton | each app gets a compatible version | two copies of stateful libs; bigger downloads |
| `eager: true` | no async bootstrap needed | bigger entry, no negotiation |
| explicit `requiredVersion` (chosen) | predictable, works with pnpm catalog | one more line per package |
| inferred `requiredVersion` | no config | `*` or a different range per importer |

Not shared on purpose: utility libraries — a shared module is a separate chunk that is not tree-shaken,
so the whole library is downloaded; duplicating the few functions an app uses is usually cheaper.

## Interview questions
- **Q:** How does Module Federation choose a version of a shared module?
  **A:** Every container registers what it bundles into a share scope keyed by version. A consumer takes the
  highest version satisfying its range; a singleton takes the already loaded (else highest) version and only
  checks the range.
- **Q:** Singleton vs non-singleton?
  **A:** Singleton guarantees one instance (needed for React, router, stores) at the cost of possibly running
  a version outside a consumer's range. Non-singleton can load several versions side by side.
- **Q:** What does `strictVersion` do at runtime?
  **A:** On a mismatch it throws instead of warning (singleton) or instead of using an incompatible version
  (non-singleton; there it falls back to the app's own copy if it has one).
- **Q:** Why do you need an async bootstrap?
  **A:** Shared modules are resolved asynchronously; the bootstrap chunk boundary gives webpack time to fill the
  share scope. Without it: "Shared module is not available for eager consumption".
- **Q:** Why not share everything?
  **A:** Shared modules are not tree-shaken and add negotiation; share only what must be a single instance or
  is large and used by many apps.

## Links
- https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints
- https://webpack.js.org/concepts/module-federation/#troubleshooting
- https://pnpm.io/catalogs
