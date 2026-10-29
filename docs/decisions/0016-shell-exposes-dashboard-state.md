# 0016 — The shell exposes the dashboard filter it owns, and reads it through its own container

- Status: accepted
- Date: 2026-10-29
- Iteration: 10

## Context
The dashboard grew a global filter — the period ("last 7 / 30 / 90 days") that the widgets report on. The control
belongs in the shell's header, next to the language and theme switches, because it applies to the whole page and the
user expects it there. The value has to reach code two federation levels below: shell → dashboard → `widget_orders`.

Until now state crossed only *one* level, and always downwards from an owner the consumer already loaded (catalog
reads `cart/store`). Here the owner is the top-level **host**, which until this iteration was not a container at all.

## Options
1. **The shell exposes `./store`** (chosen by the user) — the same ownership rule as `cart/store` (ADR 0009): the
   state lives in the app whose UI changes it, consumers get functions, not the raw store. − It makes the shell a
   remote of its own remotes, so the container graph becomes circular, and it hits the problem below.
2. **A store instance registered in the `@mf/services` container** — the shell creates the store in `bootstrap.tsx`
   and registers it under a key, widgets call `useService(DASHBOARD_PERIOD_SERVICE)`. No new container edges,
   standalone keeps working without the shell being up. − The store's *type* has to live in a shared package anyway,
   and a service key is a weaker contract than an expose: nothing stops a widget from registering its own.
3. **Props through the dashboard** — `shell → dashboard/App → WidgetProps`. Explicit and type-checked end to end.
   − The widget contract grows a field for every piece of shell state, and the dashboard becomes a forwarder that
   must be redeployed whenever the shell adds one.

## Decision
Option 1. `apps/shell` gains `filename: 'remoteEntry.js'` and `exposes: { './store': './src/exposed/store.ts' }`;
`widget_orders` lists `shell` in its `remotes`.

The part that is not obvious: **the shell's own bundle may not import that module directly.** A build with
`exposes` has two entry points — the app's `main.js` and the container's `remoteEntry.js` — and each carries its own
webpack runtime, i.e. its own `__webpack_module_cache__` (verified in the dev build: both files define
`var __webpack_modules__` and `__webpack_module_cache__ = {}`). A relative `import '../dashboard-period/store'` from
the shell's header therefore evaluates the module a **second** time and creates a second Zustand store: the header
would switch a value nothing else can see.

So the shell reads its own state the way everybody else does, through the container:

```js
// apps/shell/webpack.config.js
remotes: { shell: 'shell@http://localhost:3000/remoteEntry.js', … }
```

```tsx
// apps/shell/src/dashboard-period/PeriodSelector.tsx
import { setDashboardPeriod, useDashboardPeriod } from 'shell/store';
```

`tsconfig.json` maps `shell/store` to `./src/exposed/store.ts` with `paths`, because a package cannot be its own
workspace dependency; webpack ignores that mapping and resolves the import through Module Federation.

The *type* of the expose is `DashboardPeriodStore` in `@mf/contracts`, not a generated declaration: the container
graph is circular (shell → dashboard → widget_orders → shell), and `typecheck` depends on `^types`, so a workspace
dependency on `shell` would make the Turborepo task graph cyclic. The shell annotates its exports with the
interface, the widget's `src/shell-store.d.ts` declares `shell/store` from the same interface, and a change to the
contract breaks whichever side is wrong.

## Consequences
- The shell's `output.publicPath` changes from `'/'` to `'auto'`: its chunks are now fetched by pages on other
  origins (a widget running standalone on :3012 loads `shell/store`), and `'/'` would resolve against *their*
  origin. The absolute `/main.js` that a refresh of `/catalog/p1` needs is kept by
  `HtmlWebpackPlugin({ publicPath: '/' })`, exactly as in every other remote.
- The header control is loaded with `React.lazy`: it reads a federated module, so it arrives over the network.
- Every consumer of `shell/store` now needs the shell's origin to be reachable — including a widget running
  standalone. A widget is no longer independent of :3000.
- Adding shell state for the widgets is additive (a new function on the expose) and needs no dashboard change: the
  dashboard forwards nothing and does not know the period exists.
- If the shell is ever split or replaced, `shell/store` is a container name in three webpack configs. Option 2
  (a service key) remains the escape hatch: it would change the import line in the widget and nothing else.
