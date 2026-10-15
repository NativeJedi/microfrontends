# ROADMAP

Each iteration: **Solve** the challenge within **Scope** → verify **Acceptance criteria** →
**walk the user through** how it works and each item of **Problems** (scenario → symptom →
root cause → fix) → write notes. Problems are explained, not reproduced as broken commits
(see CLAUDE.md working rules). Challenge numbers (#N) refer to the original challenge list.
Agents read the overview and **only the current iteration's section**.

Status values: `todo` · `in progress` · `done` · `blocked`

## Overview

| # | Iteration | Challenge | Status |
|---|---|---|---|
| 00 | Skeleton | — | done |
| 01 | Shared dependencies and versioning | #2 | done |
| 02 | Types for remotes | #4 | done |
| 03 | Routing | #5 | done |
| 04 | Contracts between micro-frontends | #3 | todo |
| 05 | State: TanStack Query + Zustand | #1 | todo |
| 06 | Style isolation | #6 | todo |
| 07 | i18n | #8 | todo |
| 08 | Auth and session | #12 | todo |
| 09 | Resilience + manual dynamic remote loading | #10 | todo |
| 10 | Nested micro-frontends: dashboard + widgets | new | todo |
| 11 | Performance | #9 | todo |
| 12 | Independent deployment | #13 | todo |
| 13 | Developer Experience | #17 | todo |
| 14 | Observability | #19 | todo |
| 15 | SSR (Server-Side Rendering) | #15 | todo |
| 16 | Bonus: migrate to Module Federation 2.0 | — | todo |

---

## 00 — Skeleton

**Goal:** monorepo with `shell` (host) + `catalog` + `cart` remotes wired with classic MF,
started by one command.

**Scope**
- Root: `pnpm-workspace.yaml`, `turbo.json` (`dev`, `build`, `typecheck`, `lint`),
  `tsconfig.base.json`, `.nvmrc`, `.editorconfig`, `.gitignore`, ESLint flat config, Prettier.
- `apps/shell`, `apps/catalog`, `apps/cart`: React + TS, **explicit** `webpack.config.js` each,
  `webpack-dev-server`, `html-webpack-plugin`, `swc-loader`.
- Async bootstrap (`index.ts` → `import('./bootstrap')`) in all apps.
- `catalog` exposes `./ProductList` (static mock products), `cart` exposes `./CartWidget`
  (static mock items).
- `shell` uses static remotes (`catalog@http://localhost:3001/remoteEntry.js`, …) and renders
  both with `React.lazy` + `Suspense`.
- `shared`: **intentionally minimal** — `{ react: {}, 'react-dom': {} }`, no singleton.
  Iteration 01 builds on this.
- Temporary `declare module 'catalog/*'` / `'cart/*'` in shell (replaced in iteration 02).

**Acceptance criteria**
- `pnpm install && pnpm dev` → `localhost:3000` shows the product list and cart widget.
- `localhost:3001` and `localhost:3002` render each remote standalone.
- `pnpm build` and `pnpm typecheck` pass.
- Notes explain what is inside `remoteEntry.js` (container with `init` and `get`).

**Out of scope:** routing, state, styling beyond minimal inline layout.

**Interview angles:** host vs remote; `exposes` / `remotes` / `shared`; why async bootstrap
("Shared module is not available for eager consumption"); what `remoteEntry.js` is.

---

## 01 — Shared dependencies and versioning (#2)

**Goal:** understand how the share scope negotiates versions and lock a safe policy.

**Problems**
1. `react` not in `shared` of `cart` and a hook inside `CartWidget` → "Invalid hook call"
   (two React copies).
2. `cart` has a different React version than shell → which version is loaded and who
   provided it (highest compatible version wins; singleton vs non-singleton).
3. No async bootstrap → "Shared module is not available for eager consumption"; why
   `eager: true` also silences it and why async bootstrap is the better fix.

**Scope**
- Final config: `singleton: true` + `requiredVersion` (read from each app's package.json)
  for react / react-dom.
- Experiment with `strictVersion: true` on a mismatch; decide policy → ADR.
- Dev-only debug helper (`window.__mfDebug()` or console table on startup) that prints
  `__webpack_share_scopes__.default`: package, versions present, which container provided each,
  which one is loaded.
- pnpm catalogs (`catalog:` protocol) to align shared dependency versions across the workspace.
- Update SPEC section 7 with the final policy.

**Acceptance criteria**
- All three problems explained in notes (scenario, exact error text, root cause, fix).
- After the fix: one React instance across shell/catalog/cart, confirmed by the debug helper.
- Mismatched version produces a visible console warning, behavior documented for
  `strictVersion` true vs false.
- ADR: shared deps policy.

**Interview angles:** version negotiation algorithm; singleton vs non-singleton; what
`strictVersion` does at runtime; why shared libs are not tree-shaken; when NOT to share.

---

## 02 — Types for remotes (#4)

**Goal:** a breaking change in a remote's exposed props is caught by `pnpm typecheck` in the host.

**Problems:** with the `declare module 'catalog/*'` stub, change `ProductList` props in catalog →
shell compiles and fails at runtime.

**Scope**
- Implement **monorepo types**: the host maps `catalog/*` / `cart/*` to the remotes' `src/exposed/*` with
  `paths`; exposed components export their props types; remotes are `workspace:*` dev dependencies of the host.
- Describe (no prototype) the other approaches and their trade-offs in notes and an ADR: emitted `.d.ts`,
  contracts package, types downloaded from the deployed remote (`@module-federation/dts-plugin`), runtime validation.

**Acceptance criteria**
- Removing/renaming a required prop in catalog's exposed component fails `pnpm typecheck` in shell.
- No `any` stubs left for remotes.
- Notes: why types cannot come "from the remote" at runtime; build-time vs deploy-time drift.

**Interview angles:** type drift with independent deploys; monorepo vs polyrepo typing.

---

## 03 — Routing (#5)

**Goal:** shell owns the URL; remotes own nested routes; navigation works across apps.

**Scope**
- Add `apps/account` (remote, port 3003) with `/account/profile` and `/account/orders`.
- shell: `BrowserRouter` + top-level routes from SPEC section 2, lazy route per remote.
- Remotes expose `./App` with **relative** nested `<Routes>`. Remote's own `BrowserRouter`
  only in its standalone bootstrap.
- `react-router` (v8; `react-router-dom` has no v8, see ADR 0007) → singleton (update SPEC section 7).
- Route constants (`ROUTES.cart`, `ROUTES.account.orders`) in a new `packages/contracts`.
- Cross-app navigation (catalog → cart) uses route constants, not string literals.
- `historyApiFallback` so deep links survive refresh.

**Problems**
1. `react-router` not shared → "useNavigate() may be used only in the context of a <Router>"
   (a `<Link>` fails earlier with a `TypeError`, see notes).
2. Remote renders its own `BrowserRouter` inside the host → two histories, back button desync.

**Acceptance criteria**
- Deep link refresh works for every route.
- Back/forward works across apps.
- Each remote is still navigable standalone.
- No cross-app URL string literals (grep check in notes).

**Interview angles:** who owns the URL; `MemoryRouter` for embedded remotes; coupling via routes.

---

## 04 — Contracts between micro-frontends (#3)

**Goal:** remotes evolve independently without breaking the host at runtime.

**Problems:** run shell against catalog from another branch/port where an exposed prop is
renamed (simulates an independent deploy) → runtime break even though each app typechecks.

**Scope**
- `packages/contracts`: props types for every exposed module, route constants, custom event
  names + payload types, (later) query key factories.
- Compatibility rules in SPEC: additive changes only (new optional props); breaking change →
  new expose (`./ProductListV2`) kept side by side until consumers migrate; deprecation notes.
- Dev-only runtime guard at the boundary (validate props/event payloads; zod allowed here).
- Script `pnpm check:exposes`: loads each remote container (node or jsdom), calls `container.get`
  for every expose declared in contracts, fails if missing.
- Demonstrate one non-breaking change and one breaking change done via V2 expose.

**Acceptance criteria**
- All apps import boundary types only from `packages/contracts`.
- `pnpm check:exposes` fails when an expose is removed and passes otherwise.
- Rules documented in SPEC section 6.

**Interview angles:** what a contract is in MF; evolving without coordinated deploys;
consumer-driven contracts.

---

## 05 — State: TanStack Query + Zustand (#1)

**Goal:** shared server cache and shared client state without hidden coupling.

**Scope**
- Create `services/api` (NestJS, in-memory): `GET /products`, `GET /products/:id`,
  `GET /orders`, `POST /orders`. CORS for dev ports with credentials.
- TanStack Query: one `QueryClient` created in shell, `QueryClientProvider` in shell only;
  `@tanstack/react-query` singleton. Remote standalone bootstrap creates its own client.
- Query key factories in `packages/contracts` (`productKeys.list()`, `orderKeys.all`, …).
- Cache sharing: cart shows product details from the cache filled by catalog (no extra request).
- Cross-app invalidation: placing an order in cart invalidates `orderKeys.all` → account updates.
- Zustand: cart items (persisted to localStorage) + mini-cart open state; header counter in shell.
- Compare two ways to share the store instance, implement the chosen one:
  - **A.** store module exposed via MF from shell (`shell/store`), instance identity by module;
  - **B.** `packages/store` workspace package shared as MF singleton.

**Problems**
1. react-query not shared → "No QueryClient set" or two caches with duplicate requests.
2. Store package imported but not shared → each app has its own store; header counter stuck at 0.

**⚠ Open decision:** store sharing A vs B — present trade-offs, user picks. ADR.

**Acceptance criteria**
- Header counter updates instantly when adding from catalog.
- Network panel: products list fetched once while switching catalog ↔ cart within `staleTime`.
- Order placed in cart appears in account orders without reload.
- ADR for store sharing; SPEC section 7 and 8 updated.

**Interview angles:** server vs client state; why not one global Redux for everything;
risks of a shared store (ownership, coupling); alternatives (custom events, BroadcastChannel).

---

## 06 — Style isolation (#6)

**Problems:** catalog adds a global reset and `.button` class, cart has its own `.button` →
result depends on load order; styles of an unmounted remote stay in `<head>`.

**Scope**
- CSS Modules everywhere, `localIdentName` prefixed with app name (`[app]__[local]__[hash:5]`).
- `packages/tokens`: CSS custom properties (colors, spacing, radius, typography); shell owns
  theme and light/dark switch; remotes consume vars with fallbacks.
- No global selectors in remotes (stylelint rule or documented grep check).
- `MiniCssExtractPlugin` for production; note how remote CSS chunks load.
- Optional demo: one component in Shadow DOM + its trade-offs (portals, fonts, events).

**Acceptance criteria**
- Conflict demo fixed; no global selectors in remotes.
- Theme switch in shell updates all apps.

**Interview angles:** isolation options and trade-offs; CSS ordering in MF; CSS-in-JS duplication.

---

## 07 — i18n (#8)

**Problems:** every app calls `i18next.init` → the last one wins (language/resources reset);
a remote fetches its locales from the host origin → 404.

**Scope**
- `i18next` + `react-i18next` singleton. shell owns init and the current language.
- Each app registers its own namespace and lazy-loads translations from **its own origin**
  (resolve URL via the remote's public path, `publicPath: 'auto'`).
- Language switch in shell propagates without reload. Standalone remote inits its own instance.
- Formatting via `Intl`.

**Acceptance criteria**
- Language switch updates all apps live.
- Namespaces load lazily, one request per app per language.
- No remote calls `init` when hosted.

**Interview angles:** ownership of translations; why public path matters for remote assets.

---

## 08 — Auth and session (#12)

**Problems:** each app has its own fetch with its own refresh → three parallel 401s trigger three
refreshes → refresh token rotation invalidates the session; logout in one tab leaves another tab logged in.

**Scope**
- api: `POST /auth/login`, `POST /auth/refresh` (rotating refresh token), `POST /auth/logout`.
  Access token short-lived, kept in memory; refresh token in httpOnly cookie (`SameSite`, `Path`).
- shell owns auth: login page, protected routes (`/account/*`, `/dashboard`), session exposure
  to remotes (via the mechanism chosen in iter 5).
- Shared HTTP client (fetch wrapper) with token injection and **single-flight refresh**
  (concurrent 401s wait for one refresh).
- Logout: `queryClient.clear()`, store reset, broadcast to other tabs (BroadcastChannel).
- Standalone remotes: dev login.

**Acceptance criteria**
- Three simultaneous 401s from different apps → exactly one refresh request (network panel).
- Logout clears all app state and logs out other tabs.
- Protected routes redirect to `/login` and back after login.

**Interview angles:** where to store tokens; refresh race; cookies and CORS when apps live on
different origins/subdomains.

---

## 09 — Resilience + manual dynamic remote loading (#10)

**Problems:** stop the cart dev server → shell fails entirely (static remote import).

**Scope**
- `packages/mf-runtime`: `loadRemote(scope, module)` implemented by hand — inject script,
  `__webpack_init_sharing__('default')`, `container.init(__webpack_share_scopes__.default)`,
  `container.get(module)` → factory. Caching, timeout, retry with backoff, cache reset on failure.
- Remote URLs from runtime `remotes.json` (served by shell), not from webpack config.
- Error boundary + `Suspense` per remote slot, fallback UI with "Retry".
- Handle: remoteEntry 404/network error, timeout, module evaluation error, render error,
  `ChunkLoadError` after redeploy.
- Degraded mode: shell stays usable when any remote is down (e.g. header counter hidden).

**Acceptance criteria**
- Killing any remote leaves the rest working with a fallback.
- Restart remote + "Retry" recovers without page reload.
- Each failure type above demonstrated and documented.

**Interview angles:** static vs dynamic remotes; what `init` / `get` do; partial deploy failures.

---

## 10 — Nested micro-frontends: dashboard + widgets (new)

**Goal:** a remote that is also a host; widgets discovered at runtime.

**Scope**
- `apps/dashboard` (port 3004): remote for shell (`/dashboard`), host for widgets.
- `apps/widgets/{sales,orders,reviews}` (3011–3013): each exposes `./Widget` implementing
  `WidgetContract` from contracts (meta: `id`, `title`, `defaultSize`, `minSize`; props: `settings`, `size`).
- api: `GET /widgets` (registry: id, scope, url, module, version), `GET/PUT /dashboard/layout`.
- dashboard loads widgets via `loadRemote` from iter 9; **no widget URLs in dashboard code**.
- One share scope across all three levels; dashboard declares the same singletons.
- Each widget: own error boundary + timeout. Widgets use the shared `QueryClient`.

**Problems**
1. dashboard bundles its own React → invalid hook call inside widgets only.
2. One widget throws → whole dashboard crashes.
3. Widget URLs hardcoded → adding a widget requires a dashboard rebuild.

**Acceptance criteria**
- Adding a registry entry (no dashboard rebuild) shows a new widget.
- One failing widget does not affect others.
- Single React instance across shell → dashboard → widget (iter 1 debug helper).

**Interview angles:** nested federation and share scope; discovery/registry; widget contract design;
who owns layout and settings.

---

## 11 — Performance (#9)

**Scope**
- Baseline first: Lighthouse, `webpack-bundle-analyzer` per app, network waterfall
  (shell → dashboard → widget), JS size per route.
- Improvements: preload/prefetch remote entries for likely routes (hover/idle), load nested widget
  entries in parallel, find duplicated libs across bundles and decide share vs duplicate,
  `contenthash` everywhere.
- Before/after table in notes.

**Acceptance criteria**
- Metrics table (LCP — Largest Contentful Paint, total JS, request count, time to dashboard ready)
  before vs after.
- Waterfall depth for dashboard reduced.

**Interview angles:** cost model of MF; shared vs duplicated deps; preloading strategies.

---

## 12 — Independent deployment (#13)

**Problems:** deploy a new remote while `remoteEntry.js` is long-cached → users get a stale entry
pointing to deleted chunks → `ChunkLoadError`.

**Scope**
- Prod builds served by nginx, one container per app + api, Docker Compose.
- Versioned paths (`/catalog/<version>/remoteEntry.js`); `remotes.json`/registry points to versions.
  Deploy = upload new version + switch pointer. Rollback = switch pointer back.
- Cache headers: `remoteEntry.js` and `remotes.json` no-cache; hashed chunks `immutable`.
- Runtime env config (one artifact for all environments).
- GitHub Actions: build/deploy only affected apps (`turbo --filter=...[origin/main]`).

**⚠ Open decision:** optional real hosting target — ask the user.

**Acceptance criteria**
- `docker compose up` runs a prod-like setup.
- catalog redeployed without rebuilding shell; rollback in under a minute.
- CI builds only affected apps.

**Interview angles:** deploy/rollback of one remote; caching strategy; compatibility windows.

---

## 13 — Developer Experience (#17)

**Scope**
- `packages/dev-harness`: providers for standalone remotes (Router, QueryClient, i18n, mock auth).
- Run shell locally with remotes from the prod-like setup except the one under development:
  override via `?remote.catalog=http://localhost:3001` stored in localStorage, visible banner,
  **compiled out of production builds** (otherwise it is an XSS vector).
- Turbo filters for "work on one app"; README section "How to work on one micro-frontend".

**Acceptance criteria**
- Developer runs only catalog locally and uses all other apps from the prod-like setup.
- Override is impossible in the production build (verified).

---

## 14 — Observability (#19)

**⚠ Open decision:** Sentry SaaS free tier vs self-hosted compatible alternative (e.g. GlitchTip).

**Scope**
- Error tracker init in shell only.
- Attribute errors to the owning app: error boundary tags (`mf`, `mf.version`), module-metadata-based
  routing (Sentry webpack plugin module metadata) to per-app projects if supported.
- Source maps uploaded per app, release = `<app>@<version>`.
- `loadRemote` timings and failures as breadcrumbs/spans.

**Acceptance criteria**
- An error in a widget shows up with the correct `mf` tag and a readable stack trace.
- Remote load failures are reported.

---

## 15 — SSR (Server-Side Rendering) (#15)

**⚠ Open decision:** research current options first (Webpack 5 + Node federation runtime,
Modern.js, framework support status) and present them **before** implementing. Agent proposes
scope and acceptance criteria; user approves.

Expected topics: loading remotes on the server, shared deps on the server, hydration,
invalidating server-side remote code after a redeploy.

---

## 16 — Bonus: migrate to Module Federation 2.0

**Scope**
- Replace `webpack.container.ModuleFederationPlugin` with `@module-federation/enhanced` (still Webpack).
- `mf-manifest.json` instead of bare `remoteEntry.js`; runtime plugins (`errorLoadRemote` etc.)
  instead of the hand-written loader; dts plugin instead of the iter 2 solution; devtools instead of
  the iter 13 override.
- Optional: try Rspack.

**Acceptance criteria**
- All previous acceptance criteria still pass.
- Notes contain a classic vs 2.0 comparison table.
