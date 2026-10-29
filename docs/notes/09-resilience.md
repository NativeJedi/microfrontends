# 09 — Resilience and manual dynamic remote loading

> Challenge: #10

## Problem

With static remotes the host's `webpack.config.js` holds a line per remote
(`cart: 'cart@http://localhost:3002/remoteEntry.js'`), and `import('cart/App')` looks like any
other import. Two things follow. The URL is **baked into the host bundle**, so a remote that moves
to a different host or CDN forces a rebuild and redeploy of the host — which defeats independent
deployment. And when a remote is unreachable, the import rejects somewhere inside `React.lazy`
with nothing around it: React unmounts the tree it was rendering, and the user gets a blank page
because one of four apps is down.

Real deployments make both happen regularly: a remote's dev server is stopped, a CDN returns 404
for a path that moved, a deploy half-finishes, a network is slow enough to look dead.

## Solution

A new workspace package `@mf/runtime` ([ADR 0014](../decisions/0014-manual-dynamic-remote-loading.md))
does by hand what webpack normally generates:

```ts
// packages/mf-runtime/src/load-remote.ts (condensed)
await loadScript(entry.url, timeoutMs);            // inject <script src=remoteEntry.js>
const container = readContainer(entry.scope);      // window[scope] → { init, get }
await __webpack_init_sharing__('default');         // fill OUR share scope
await container.init(__webpack_share_scopes__.default); // hand it to the remote
const factory = await container.get(module);       // './App' → () => moduleNamespace
return await factory();
```

The URLs come from a registry the host **serves** rather than bundles:

```json
{
  "catalog": { "scope": "catalog", "url": "http://localhost:3001/remoteEntry.js" },
  "cart":    { "scope": "cart",    "url": "http://localhost:3002/remoteEntry.js" },
  "account": { "scope": "account", "url": "http://localhost:3003/remoteEntry.js" }
}
```

`apps/shell/webpack.config.js` no longer has a `remotes` key at all; `bootstrap.tsx` only says
where the registry lives:

```ts
configureRemotes({ configUrl: '/remotes.json' });
```

Each remote then renders inside its own slot — an error boundary plus a Suspense boundary, with a
fallback the host supplies:

```tsx
<RemoteSlot<CatalogAppProps>
  remote="catalog"
  module="./App"
  pending={<p>{t('loading')}</p>}
  fallback={(state) => <RemoteFallback name={t('nav.catalog')} {...state} />}
/>
```

The header's cart counter has its own slot and **degrades instead of failing**: when cart is down
the link to the cart page stays, only the live item count disappears.

## How it works

`remoteEntry.js` is not a bundle of the remote's code. It is a tiny **container**: a script that
assigns `window[scope] = { init, get }` and nothing more.

- `init(shareScope)` is how two bundles agree on shared libraries. The host first calls
  `__webpack_init_sharing__('default')`, which fills *its* share scope object with everything it
  declared under `shared` (react, react-router, …), then passes that same object to the container.
  The remote registers its own versions into it and, for each `shared` module, takes the highest
  compatible one that is already there. That handshake is the only reason one React ends up on the
  page; `__mfDebug()` shows the result — seven packages, all `providedBy: shell`.
- `get('./App')` resolves to a **factory**, not the module: webpack first loads the chunk that
  holds the exposed module, then hands back `() => __webpack_require__(id)`. Calling the factory
  evaluates the module and returns its namespace (`{ default: App }`).

Everything else in the package exists because that sequence can fail in more than one way:

- **Caching with reset on failure.** The registry, each container and each module are cached as
  promises — but a *rejected* promise is deleted from the cache, otherwise the "Retry" button
  would replay the stored rejection forever.
- **Retry with backoff, for transient reasons only.** `config`, `script` and `timeout` get one
  automatic retry (300 ms, doubling). `container-missing`, `get` and `evaluate` do not: they are
  deploy mistakes, and retrying only delays the fallback.
- **A typed error.** Every failure becomes a `RemoteLoadError` carrying `remote`, `module` and a
  `reason`, which is what lets the fallback print `script: Remote "cart" could not be fetched from
  http://localhost:3999/remoteEntry.js` instead of a generic apology.
- **Retry re-reads the registry.** `resetRemotes(remote)` drops the cached config too, so a remote
  that moved is picked up without a page reload.

Types did not change hands. `loadRemote` takes two strings, so the remotes stay `devDependencies`
and `apps/shell/src/remotes/remote-props.ts` imports their declarations with `import type` — erased
at compile time, invisible to webpack, but still enough to break `pnpm typecheck` if a remote
renames an expose or changes its props.

## What can go wrong

### 1. A remote is unreachable (stopped server, 404, CORS, wrong URL)

- **Symptom:** in the console, `GET http://localhost:3999/remoteEntry.js net::ERR_CONNECTION_REFUSED`,
  then in the page `Cart is unavailable right now. / script: Remote "cart" could not be fetched
  from http://localhost:3999/remoteEntry.js` with a Retry button. The catalog route, the header and
  the login page keep working.
- **Root cause:** the browser fired `error` on the injected `<script>`. A 404 and a refused
  connection are indistinguishable at this level — the script simply never ran, so `window[scope]`
  was never assigned.
- **Fix:** the slot's error boundary turns it into a hole in the page instead of a blank page. With
  static remotes there is no equivalent: the rejection happens inside the `import()` that React
  awaited, so without a boundary per slot the host tree unmounts. Retry re-fetches the registry and
  starts over; after the remote is back, the slot recovers **without a page reload**.

### 2. The remote answers, but too slowly

- **Symptom:** `timeout: Remote "catalog" could not be fetched from http://localhost:3998/remoteEntry.js`
  after the configured wait.
- **Root cause:** a `<script>` has no timeout of its own. It will wait as long as the connection
  stays open, so a server that accepts the socket and never answers hangs the slot forever.
- **Fix:** `loadScript` races the load against a `setTimeout` (8 s by default, `timeoutMs` per
  remote in the registry). Note the subtlety: removing the `<script>` element does **not** abort
  the request, so the entry may still arrive and define the container afterwards — which is why
  `initContainer` checks `readContainer(scope)` first and skips the fetch when the container is
  already there. A late arrival turns the next attempt into a success.

### 3. The container name does not match the registry

- **Symptom:** `container-missing: http://localhost:3001/remoteEntry.js loaded but defined no
  container named "catalog_v2"`.
- **Root cause:** `scope` in the registry must equal `name` in the remote's
  `ModuleFederationPlugin`, not its URL path or its folder. The script loaded fine and assigned
  `window.catalog`; we looked for `window.catalog_v2`.
- **Fix:** read the name from the remote's config. This is not retried — nothing about it is
  transient. The same class of mistake is a remote missing from the registry entirely:
  `unknown-remote: Remote "catalog" is not listed in /remotes.json`.

### 4. The exposed module throws while being evaluated

- **Symptom:** `evaluate: "./App" of remote "cart" threw while being evaluated`.
- **Root cause:** `container.get()` succeeded — the chunk is there — but running the module body
  threw, e.g. a module-scope assertion or a missing global.
- **Fix:** the factory call is wrapped, and it is wrapped with `return await factory()`, not
  `return factory()`. An exposed module that itself consumes another remote (catalog imports
  `cart/store`) is compiled as an **async module**, and webpack hands back a thenable namespace;
  returning it unawaited would let its rejection escape the `try/catch` and surface as a raw error
  with no reason attached.
- **Worth knowing:** webpack puts a module into its cache *before* executing it, and the harmony
  export getters are installed before the module body runs. A module that throws therefore leaves a
  half-initialised, exported-looking entry behind, and a second `require` of it can succeed and
  hide the failure. This is also why `resetRemotes()` cannot undo a bad module: it drops our
  promises, not webpack's module cache.

### 5. The remote renders, then throws

- **Symptom:** `Cart is unavailable right now. / render blew up inside the remote component`, with
  no `reason:` prefix because it is not a `RemoteLoadError`. The header counter — a different
  module of the same remote — keeps working.
- **Root cause:** an ordinary React render error, thrown after loading succeeded.
- **Fix:** the same boundary covers it, which is the point of pairing the error boundary with the
  Suspense boundary in one slot. Note that `React.lazy` caches the outcome of its loader **on the
  component type**, a rejection included: remounting the same lazy component replays the stored
  error. That is why `RemoteSlot` builds a brand new lazy component on retry instead of bumping a
  `key`.

### 6. `ChunkLoadError` after a redeploy

- **Symptom:** `Loading chunk 123 failed.` and the fallback offers **Reload the page** instead of
  Retry.
- **Root cause:** the page loaded a container, the remote was then redeployed with new content
  hashes, and the container in memory now asks for chunk files that no longer exist. The container
  object cannot be replaced — `window[scope]` is already assigned and its runtime knows the old
  names.
- **Fix:** `isChunkLoadError` (which also looks through `error.cause`) switches the fallback to a
  reload, because retrying would re-run the same stale container. The real fixes are on the deploy
  side: keep old chunks around for a grace period, or version the remote entry.

### 7. Two share scopes on one page

- **Symptom:** `Container initialization failed as it has already been initialized with a different
  share scope`, which we hit by injecting a remote entry by hand and skipping
  `__webpack_init_sharing__`.
- **Root cause:** a container may be initialised once, with one scope object. Calling `init` again
  with a *different* object throws; calling it with the same object is harmless, which is what makes
  the per-module caching safe.
- **Fix:** always `__webpack_init_sharing__('default')` before `container.init`, and always pass
  `__webpack_share_scopes__.default`. Get this wrong and the remote quietly falls back to its own
  React — "Invalid hook call" instead of a readable error. Iteration 10 has to keep this right
  across three levels.

### 8. The dev server hides the whole thing

- **Symptom:** editing `public/remotes.json` reloads the page by itself, so a slot that should show
  a fallback silently comes back green.
- **Root cause:** `devServer.static` watches its directory and triggers a live reload.
- **Fix:** `static: { directory: …, watch: false }`. Nothing watches that file in production
  either, so development now behaves the way the deployed app does.

## Trade-offs and alternatives

| Option | Pros | Cons |
|---|---|---|
| Static `remotes` + per-slot boundaries | No new code; webpack does the handshake | URLs baked into the host; the set of remotes is fixed at build time |
| Promise-based dynamic remotes in the config | webpack still does the handshake; URL readable at runtime | Keys still fixed at build time; the logic is an untypeable string in `webpack.config.js` |
| **Hand-written `loadRemote` (chosen)** | Runtime URLs *and* a runtime set of remotes; every failure mode is ours to classify; the mechanism is readable TypeScript | ~200 lines to own: caching, retry, timeouts |
| MF 2.0 runtime (`@module-federation/enhanced`) | Maintained implementation of the same API | Outside the stack of ADR 0001; hides the mechanism; revisit in iteration 17 |

## Interview questions

- **Q:** What is actually inside `remoteEntry.js`, and what do `init` and `get` do?
  **A:** Not the remote's code — a container object on `window[scope]` with two functions. `init`
  takes the host's share scope, registers the remote's own shared modules into it and adopts the
  highest compatible version already present; that handshake is what keeps one React on the page.
  `get('./X')` loads the chunk holding the exposed module and returns a factory; calling the factory
  evaluates the module and returns its namespace.

- **Q:** Why does `import('cart/App')` not need any of that, and what do you lose by writing it
  yourself?
  **A:** With a `remotes` entry webpack generates exactly this sequence with the URL inlined. You
  lose that generation — and gain the ability to decide the URL, and the *set* of remotes, at
  runtime, plus control over timeouts, retries and how each failure is reported.

- **Q:** A remote is down. Why is a `<Suspense>` fallback not enough?
  **A:** Suspense covers *pending*, not *failed*. A rejected lazy loader throws during render, and
  without an error boundary React unmounts up to the nearest one — in practice the whole host. The
  slot needs both, and the boundary must be per remote, or one dead remote still takes its
  neighbours with it.

- **Q:** Why must a failed load never be cached, and why is a `key` change not enough to retry?
  **A:** A cached rejected promise makes "Retry" replay the same error. And `React.lazy` memoises
  its loader result on the component type, so remounting it rethrows; a genuine retry needs a new
  lazy component (and, so that a moved remote is picked up, a re-read of the registry).

- **Q:** Which failures are worth retrying automatically?
  **A:** Only the transient ones — registry fetch, script load, timeout. A missing expose, a wrong
  container name or a module that throws will fail identically on the second attempt; retrying them
  just delays the fallback the user needs to see.

## Links

- Webpack, Module Federation: https://webpack.js.org/concepts/module-federation/
- Webpack, `ModuleFederationPlugin`: https://webpack.js.org/plugins/module-federation-plugin/
- React, `lazy`: https://react.dev/reference/react/lazy
- React, error boundaries (`Component.getDerivedStateFromError`): https://react.dev/reference/react/Component#static-getderivedstatefromerror
- webpack-dev-server, `devServer.static`: https://webpack.js.org/configuration/dev-server/#devserverstatic
