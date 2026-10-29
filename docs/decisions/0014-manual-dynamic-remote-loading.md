# 0014 — Manual dynamic remote loading

- Status: accepted
- Date: 2026-10-29
- Iteration: 09

## Context

Until iteration 09 the shell listed its remotes in `webpack.config.js`:

```js
remotes: { catalog: 'catalog@http://localhost:3001/remoteEntry.js', /* … */ }
```

Two consequences follow from that one line. First, every remote URL is **baked into the host
bundle at build time**, so moving a remote to another host or CDN means rebuilding and
redeploying the shell — the opposite of what independent deployment (iteration 13) is for.
Second, `import('catalog/App')` is an ordinary import: webpack fetches `remoteEntry.js` the first
time the module is needed, and a failure surfaces as a rejected promise inside `React.lazy` with
nothing around it. One dead remote therefore unmounts the host's whole tree — a blank page, not a
missing section.

Iteration 10 adds a second reason: the dashboard must render widgets listed in an API registry,
whose set is unknown when the dashboard is built.

## Options

1. **Keep static remotes, add error boundaries.** Pros: no new code, webpack keeps doing the
   container handshake. Cons: URLs stay baked in; the set of remotes is fixed at build time, so a
   registry is impossible; nothing to learn about what MF actually does.
2. **Promise-based dynamic remotes** (`remotes: { cart: 'promise new Promise(resolve => …)' }`).
   Pros: webpack still performs the handshake, and the URL can be read at runtime. Cons: the
   **keys** are still fixed at build time, so adding a widget still needs a host rebuild; the
   implementation is a JavaScript string inside the config, which cannot be typed, linted or
   stepped through; error handling stays webpack's.
3. **Hand-written `loadRemote()` over the container protocol.** Pros: URLs and the set of remotes
   both come from runtime config; every failure mode is ours to classify and present; the
   mechanism (`__webpack_init_sharing__` → `container.init` → `container.get`) is visible in
   readable TypeScript. Cons: ~200 lines to own, including caching and retry semantics webpack
   would otherwise provide.
4. **Adopt Module Federation 2.0's runtime** (`@module-federation/enhanced`), which ships
   `loadRemote` and `registerRemotes`. Pros: maintained, batteries included. Cons: outside the
   stack fixed in [ADR 0001](0001-webpack5-classic-module-federation.md); the migration is
   iteration 17's subject, and taking it now would hide exactly the mechanism this project exists
   to explain.

## Decision

Option 3: a `@mf/runtime` workspace package with `loadRemote(remote, module)`, fed by a runtime
registry (`remotes.json`, served by the host), plus a headless `RemoteSlot` that pairs an error
boundary with a Suspense boundary per remote.

The package is **not** MF-shared. It is bundled into each host, so every host — the shell now, the
dashboard in iteration 10 — gets its own registry and its own caches. Nothing in it holds state
that must be unique per page.

Supporting choices:

- **The registry is served, never bundled.** `public/remotes.json` is served as-is in development
  and emitted next to the bundle in a production build as a default that a deployment overwrites.
  `grep` over `apps/shell/dist/*.js` finds no remote URL.
- **`devServer.static.watch: false`** for the shell. The default reloads the page whenever a file
  under `public/` changes, which would turn "edit the registry, then press Retry" into a silent
  full reload and hide the behaviour the iteration is about.
- **Types keep coming from the workspace packages.** `loadRemote` takes two strings, so the
  remotes stay `devDependencies` and the shell imports their declarations with `import type`
  (`apps/shell/src/remotes/remote-props.ts`). The compile-time contract of
  [ADR 0008](0008-contracts-between-micro-frontends.md) survives; only the loading changed.
- **Retries are for transient failures only** (`config`, `script`, `timeout`). A missing expose or
  a container that never appeared is a deploy mistake, and retrying it only delays the fallback.

## Consequences

Easier: a remote can move to a new URL without rebuilding the shell; a remote that is down costs
its own slot and nothing else; iteration 10's registry-driven widgets need no new loading code.

Harder: the share scope handshake is now the host's responsibility, and getting its order wrong
produces two Reacts instead of a loud error. Caching is ours too — in particular a *rejected*
attempt must never be cached, or "Retry" becomes a no-op.

To revisit: a container that is already on `window` cannot be replaced without a page reload, so a
changed URL only affects remotes that have not loaded yet. Iteration 17 should re-evaluate this
package against the MF 2.0 runtime, which solves the same problems with a maintained
implementation.
