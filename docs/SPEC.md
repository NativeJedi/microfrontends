# SPEC — Micro-frontends Marketplace Demo

## 1. Purpose

Learn micro-frontends and Webpack 5 Module Federation (MF) by building a small
marketplace incrementally. Each iteration (see `ROADMAP.md`) isolates one challenge:
solve it → walk through how it works, what can go wrong and how to fix it → document
trade-offs and interview angles. Problems are explained, not reproduced as broken commits.

Non-goals: a polished product, a design system, a full E2E (end-to-end) test suite,
cross-framework micro-frontends, a polyrepo setup.

## 2. Domain and app map

A marketplace with a buyer side (catalog, cart, account) and a seller dashboard
built from independently deployed widgets.

| App | Path | Role | Dev port | Container name | Exposes (planned) | Introduced in |
|---|---|---|---|---|---|---|
| shell | `apps/shell` | Host: layout, header, routing, auth, providers | 3000 | `shell` | — (services via `@mf/services`, iter 8) | 00 |
| catalog | `apps/catalog` | Remote: product list and product details (consumes `cart/store`) | 3001 | `catalog` | `./App` (routes; `./ProductList` until iter 3) | 00 |
| cart | `apps/cart` | Remote: cart page, mini-cart widget, checkout | 3002 | `cart` | `./App`, `./CartWidget`, `./store` | 00 |
| account | `apps/account` | Remote: profile, order history | 3003 | `account` | `./App` | 03 |
| dashboard | `apps/dashboard` | Remote for shell **and** host for widgets | 3004 | `dashboard` | `./App` | 10 |
| widget-sales | `apps/widgets/sales` | Remote widget | 3011 | `widget_sales` | `./Widget` | 10 |
| widget-orders | `apps/widgets/orders` | Remote widget | 3012 | `widget_orders` | `./Widget` | 10 |
| widget-reviews | `apps/widgets/reviews` | Remote widget | 3013 | `widget_reviews` | `./Widget` | 10 |
| api | `services/api` | NestJS backend: products, orders, auth, widget registry | 4000 | — | — | 05 |

Container names must be valid JS identifiers (hence `widget_sales`, not `widget-sales`).

### Routes (owned by shell)

| URL | Rendered by |
|---|---|
| `/` | redirect to `/catalog` |
| `/catalog/*` | catalog |
| `/cart/*` | cart |
| `/account/*` | account (protected, iter 8) |
| `/dashboard` | dashboard → widgets (protected from iter 8) |
| `/login?returnTo=<path>` | shell (iter 8) |

Route constants (`ROUTES`) live in `packages/contracts` (from iter 3). No hardcoded URLs in links or redirects.
`/login` was added in iteration 08 (`ROUTES.login(returnTo?)`), `/dashboard` in iteration 10 (`ROUTES.dashboard`,
a single route with no splat: the dashboard is one page and renders no router of its own).

## 3. Architecture

```
                        ┌────────────────────────── browser ──────────────────────────┐
                        │  shell (host)  :3000                                         │
                        │  ├─ providers: Router, QueryClient, i18n, Auth, Theme        │
                        │  ├─ catalog   :3001  (remote)                                │
                        │  ├─ cart      :3002  (remote)                                │
                        │  ├─ account   :3003  (remote)                                │
                        │  └─ dashboard :3004  (remote + host)                         │
                        │       ├─ widget_sales   :3011                                │
                        │       ├─ widget_orders  :3012                                │
                        │       └─ widget_reviews :3013                                │
                        │  one share scope "default" across all levels                 │
                        └──────────────────────────────┬───────────────────────────────┘
                                                       │ HTTP (fetch, credentials)
                                               services/api :4000 (NestJS)
```

Ownership rules:
- **shell** owns: URL/history, top-level layout, auth session (session + API client, registered in the service
  container), QueryClient instance, i18n instance, theme, Sentry init. Remotes never create these when hosted.
- **Remotes** own: their routes below their prefix, their UI, their translations (one i18n namespace each),
  their query hooks (using shared query options from `@mf/queries`), and the client state of their domain
  (cart owns the cart store and exposes it as `cart/store`, [ADR 0009](decisions/0009-cart-store-exposed-by-owner.md)).
- **dashboard** owns widget layout (order, size, settings) and widget loading. The API registry (`GET /widgets`)
  owns which widgets exist; in iteration 10 the widget URLs are still static `remotes` in the dashboard's webpack
  config ([ADR 0015](decisions/0015-static-widget-remotes.md)) and move to the registry with iteration 09's
  `loadRemote`. A **widget** owns everything inside its card: its UI, its i18n namespace and the meaning of its
  settings ([ADR 0014](decisions/0014-widget-contract.md)).

## 4. Tech stack

Install **current stable** versions at the time of iteration 0 and record exact
versions in the PROGRESS.md entry. Versions are aligned across the workspace with
pnpm catalogs (from iter 1).

| Layer | Choice | Notes |
|---|---|---|
| Package manager | pnpm workspaces | `.nvmrc` pins Node.js active LTS |
| Monorepo tasks | Turborepo | `dev`, `build`, `typecheck`, `lint` pipelines |
| Bundler | Webpack 5 + `webpack.container.ModuleFederationPlugin` (classic) | No `@module-federation/*` packages until iter 17, except where an iteration explicitly allows it |
| Transpiling | `swc-loader` | Types checked separately with `tsc --noEmit` |
| Dev server | `webpack-dev-server` | `historyApiFallback: true`, CORS headers for remotes |
| UI | React + TypeScript (strict) | |
| Routing | React Router 8, package `react-router` (declarative mode) | iter 3, [ADR 0007](decisions/0007-react-router-8.md) |
| Server state | TanStack Query | single `QueryClient` from shell, iter 5 |
| Client shared state | Zustand | iter 5, store exposed by its owner ([ADR 0009](decisions/0009-cart-store-exposed-by-owner.md)) |
| Styles | CSS Modules (`css-loader`; `style-loader` in dev, `mini-css-extract-plugin` in production) + CSS custom properties (`@mf/tokens`); stylelint for remotes | iter 6, [ADR 0011](decisions/0011-style-isolation.md) |
| i18n (internationalization) | i18next + react-i18next; one instance from shell, namespaces loaded by their owners | iter 7, [ADR 0012](decisions/0012-i18n-ownership.md) |
| Backend | NestJS (in-memory data, no DB) | iter 5; auth in iter 8 |
| Auth | JWT (JSON Web Token) access token + rotating refresh token, both in httpOnly `SameSite=Strict` cookies (`@nestjs/jwt`, `cookie-parser`) | iter 8, [ADR 0013](decisions/0013-auth-session.md) |
| Services to remotes | `@mf/services`: generic service container + React provider, MF shared singleton | iter 8, [ADR 0013](decisions/0013-auth-session.md) |
| Widget contract | `@mf/contracts`: `./Widget` = default component (`settings`, `size`) + named `meta` | iter 10, [ADR 0014](decisions/0014-widget-contract.md) |
| Containers | Docker Compose + nginx | iter 13 |
| CI | GitHub Actions | iter 13 |
| Observability | Sentry (⚠ open decision in iter 15) | iter 15 |
| Lint/format | ESLint (flat config) + Prettier | iter 0 |

Pinned exceptions to "current stable" (ADR 0004): TypeScript `~6.0.3` and ESLint `^9.39` until
typescript-eslint and eslint-plugin-react support TypeScript 7 / ESLint 10.

## 5. Repository structure

```
.
├─ CLAUDE.md
├─ docs/
│  ├─ SPEC.md  ROADMAP.md  PROGRESS.md
│  ├─ decisions/        # ADRs: NNNN-title.md
│  └─ notes/            # per-iteration learning notes: NN-slug.md
├─ apps/
│  ├─ shell/  catalog/  cart/  account/  dashboard/
│  └─ widgets/{sales,orders,reviews}/
├─ services/
│  └─ api/
├─ packages/            # created only by the iteration that needs them
│  ├─ contracts/        # @mf/contracts — iter 3: route constants; iter 4: events
│  ├─ api-client/       # @mf/api-client — iter 5: API types + request functions (stateless)
│  ├─ queries/          # @mf/queries — iter 5: query keys + queryOptions (stateless)
│  ├─ tokens/           # @mf/tokens — iter 6: CSS custom properties (light/dark)
│  ├─ i18n/             # @mf/i18n — iter 7: languages, createI18n, namespace loader backend (stateless)
│  ├─ services/         # @mf/services — iter 8: generic service container (DI), MF shared singleton
│  ├─ mf-runtime/       # iter 9: loadRemote(), remote config
│  └─ dev-harness/      # iter 14: standalone providers for remotes
├─ pnpm-workspace.yaml
├─ turbo.json
└─ tsconfig.base.json
```

Typical app layout:

```
apps/catalog/
├─ webpack.config.js    # explicit, no shared factory until there is a reason
├─ package.json         # remotes: "exports" lists the types of every expose (iter 4)
├─ tsconfig.types.json  # remotes: emits declarations of src/exposed into types/ (gitignored)
├─ tsconfig.json
├─ public/index.html
└─ src/
   ├─ index.ts          # ONLY: import('./bootstrap')
   ├─ bootstrap.tsx     # standalone mount (own providers when not hosted)
   └─ exposed/          # modules listed in `exposes`
```

## 6. Conventions

### Module Federation
- **Async bootstrap is mandatory** in every app: `src/index.ts` contains only
  `import('./bootstrap')`. This lets the share scope initialize before any shared module is consumed.
- `output.publicPath: 'auto'` in remotes so their chunks and assets load from their own origin.
- `output.uniqueName` = container name.
- Remote entry file name: `remoteEntry.js`.
- Exposed modules: `./App` for a route-level app, `./Widget` for dashboard widgets,
  other names only for small embeddable pieces (e.g. `./CartWidget`).
- Exposed React modules use a **default export** (for `React.lazy`). Everything else uses named exports.
- Types of remote modules (iter 4, [ADR 0008](decisions/0008-contracts-between-micro-frontends.md), supersedes
  ADR 0006): the **remote owns** the props types of its exposes (named exports next to the default-exported component).
  Its `types` task (`tsconfig.types.json`) emits declarations of `src/exposed` into `types/`, and its `package.json`
  `exports` maps every expose to them (`"./CartWidget": { "types": "./types/exposed/CartWidget.d.ts" }`).
  The host lists each remote as `"<remote>": "workspace:*"` in `devDependencies` and imports `cart/CartWidget`
  with no `paths`; `typecheck` depends on `^types` in Turborepo. No ambient `declare module '<remote>/*'` stubs.

### Contracts between micro-frontends (iter 4, [notes](notes/04-contracts.md))
- **Every expose is declared twice and kept in sync:** webpack `exposes` (runtime) and package `exports` (types).
- **Additive changes only** within one expose / event: new optional props, new optional payload fields, new exposes,
  new events. Receivers ignore unknown fields.
- **Breaking change = new name:** a new expose `./XV2` or a new event `<app>:<event>.v2`. The old one stays as a thin
  adapter over the new one, marked `@deprecated` (JSDoc) with the reason, and is removed only when no deployed host
  uses it.
- **No runtime validation between our own apps:** typed exposes and events are trusted like any import; deploy-time
  mismatches are the job of contract testing (iteration 12) and error boundaries (iteration 09). Validate only untrusted
  inputs (API responses, cross-origin `postMessage`, third-party code, `localStorage`).
- **Cross-app events** go through `@mf/contracts` (`MF_EVENTS`, `dispatchMfEvent`, `subscribeToMfEvent`): DOM
  `CustomEvent` on `window`, name `<owner-app>:<kebab-name>`, the owner is the producer. Events are fire-and-forget
  (no replay for late subscribers).
- Automated verification against what is deployed (contract testing, deploy gating) — iteration 12.

### Routing (iter 3, [notes](notes/03-routing.md))
- The shell owns the only `<BrowserRouter>` and mounts each remote's `./App` under its prefix with a splat
  (`/catalog/*`). Remotes declare **relative** `<Routes>` and never render a router in `./App`; their
  standalone `bootstrap.tsx` wraps `<App />` in its own `<BrowserRouter>` under the same prefix.
- Every link and redirect uses `ROUTES` from `@mf/contracts`, also inside a remote (relative links in a splat
  route resolve against the full URL).
- Shell `output.publicPath: '/'`; remotes keep `'auto'` and set `HtmlWebpackPlugin({ publicPath: '/' })` so
  deep links survive a refresh.
- Workspace packages such as `@mf/contracts` export TypeScript source and are bundled into each app; they are
  not MF-shared unless they hold state.

### State (iter 5, [notes](notes/05-state.md))
- One `QueryClient`, created in the shell's `bootstrap.tsx`; `@tanstack/react-query` is an MF singleton. Remotes
  create a client only in their standalone `bootstrap.tsx`, never in `exposed/`.
- Layers ([ADR 0010](decisions/0010-api-client-and-queries-packages.md)): `@mf/api-client` — API types, request
  functions (`getOrders(api)`) and the factories `createSession` / `createApiClient`, no React; `@mf/queries` — key factories (`productKeys`, `orderKeys`) and `queryOptions` factories
  (`productQueries`, `orderQueries`): key, fetcher, response type and `staleTime` travel together; `@mf/contracts` —
  routes and events only.
- Workspace packages are **stateless** (bundled into each app). Stateful instances (`QueryClient`, the session and the
  API client of iter 8) are created once by the shell and reach remotes through context: the QueryClient through
  react-query's, the others through the `@mf/services` container ([ADR 0013](decisions/0013-auth-session.md)). Query keys are a
  cross-app contract (renaming one is a breaking change). Cache settings live in the query options, not in
  `QueryClient` defaults, so a remote caches the same way hosted and standalone.
- Mutations invalidate by the owner's key factory (`orderKeys.all`); other apps refetch on their next mount.
- Shared client state is owned by the app of its domain and exposed as functions (`cart/store`: `addToCart`,
  `useCartQuantity`), never as the raw store. Persisted keys are prefixed with the owner (`cart:items`) and the
  persisted value is narrowed on load (`localStorage` is untrusted).

### Styles (iter 6, [notes](notes/06-styles.md), [ADR 0011](decisions/0011-style-isolation.md))
- Every component style is a CSS Module (`X.module.css` next to `X.tsx`); `localIdentName` is
  `'<app>__[local]__[hash:base64:5]'` with a literal app prefix in each `webpack.config.js`. No inline `style={{}}`.
- Global CSS exists only in the shell (`global.css` — the only reset) and in `@mf/tokens`. Remotes ship no global
  selectors; stylelint (`stylelint.config.js`, part of `pnpm lint`) enforces it.
- Tokens are CSS custom properties `--mf-*` (a cross-app contract: renaming one is breaking). The shell loads
  `@mf/tokens/tokens.css` and owns the theme (`<html data-theme="dark">`, persisted as `shell:theme`); remotes read
  `var(--mf-…, <fallback>)` and import `tokens.css` only in their standalone `bootstrap.tsx`.
- Dev: `style-loader`. Production: `MiniCssExtractPlugin`; remote CSS chunks load as `<link>` from the remote origin.

### i18n (iter 7, [notes](notes/07-i18n.md), [ADR 0012](decisions/0012-i18n-ownership.md))
- One i18next instance, created by the shell's `bootstrap.tsx` with `createI18n()` from `@mf/i18n` and passed through
  `<I18nextProvider>`. Remotes call `createI18n` only in their standalone `bootstrap.tsx`; `exposed/` code never creates
  or inits an instance. Languages: `en` (default), `uk`; no fallback language.
- The shell owns the current language (header `<select>`, persisted as `shell:language`, `<html lang>`).
- Every app owns **one namespace named after its container** (`shell`, `catalog`, `cart`, `account`) with
  `src/i18n/locales/<lng>.json` and one hook `use<App>Translation()` built on `useNamespaceTranslation(ns, loader)`.
  The loader is a dynamic `import()` of the JSON, so translations are chunks of the owning app loaded from its
  `publicPath: 'auto'` — never a root-relative URL. Namespace names are a cross-app contract.
- Texts a host passes into a remote's props (e.g. `CartWidget` `label`) are translated by the host.
- Numbers, currency, dates and plurals go through i18next's `Intl` formatters (`{{value, currency(USD)}}`,
  `{{value, datetime}}`, `_one/_few/_many/_other`), never hand-formatted. API content is not translated.

### Auth and services (iter 8, [notes](notes/08-auth.md), [ADR 0013](decisions/0013-auth-session.md))
- Tokens live only in httpOnly cookies set by the API (`access_token` `Path=/`, `refresh_token` `Path=/auth`,
  `SameSite=Strict`). JS never reads a token; every request uses `credentials: 'include'`. Apps and API must stay on
  one site (iteration 13).
- The only session state in JS is the flag `auth:is-logged-in` in `localStorage` (`createSession()`): a UI hint, never
  an authorization decision. Rule: 401 → one single-flight refresh → one retry; refresh failed or retry 401 → session
  ends.
- One session and one API client per page: created in the shell's `bootstrap.tsx`, registered in a
  `createServiceContainer()` under the keys `SESSION_SERVICE` / `API_CLIENT_SERVICE`, provided with
  `<ServicesProvider>`. Remotes call `useService(key)` and never create them in `exposed/`; standalone bootstraps
  create their own (dev login with `DEV_CREDENTIALS`).
- `@mf/services` is generic: it knows no concrete service. Keys are strings (`defineServiceKey<T>(name)`), because
  objects differ per bundle. Key names are a cross-app contract. A new service is a new key (additive).
- Session end, any cause, any tab (`storage` event) → the shell clears the query cache and dispatches
  `shell:logged-out`; every app with user-specific client state resets it (cart clears its store).
- Route guards (`RequireAuth`) are UX only; the API protects data (global guard, `@AuthMode`). `returnTo` accepts
  only same-app absolute paths.

### Dashboard widgets (iter 10, [notes](notes/10-nested.md), [ADR 0014](decisions/0014-widget-contract.md), [ADR 0015](decisions/0015-static-widget-remotes.md))
- The dashboard is a **remote and a host at once**: one `ModuleFederationPlugin` with both `exposes` and `remotes`.
  An intermediate host must declare the same singletons as the shell — it does not create a scope for its children,
  it passes on the one it was initialized with, and its own imports must be consumptions from it.
- A widget exposes `./Widget`: a default-exported component taking `WidgetProps` (`settings`, `size`) plus a named
  export `meta: WidgetMeta` (`id`, `title`, `defaultSize`, `minSize`). The host resolves the module itself (`use()`
  on a promise cached per widget id) because `React.lazy` cannot reach `meta`; a retry drops that cached promise.
- Widgets render no routes and no links, so they declare no `react-router` and work in any host. Their i18n
  namespace is their container name (`widget_sales`, …).
- **Size is a negotiation:** the layout proposes, the widget's `minSize` vetoes (`clampWidgetSize`). The card heading
  is the host's text, translated by the dashboard and keyed by widget id, with `meta.title` as the fallback for a
  widget it has no translation for.
- `settings` crosses as `Readonly<Record<string, unknown>>` and is narrowed by the widget that owns the keys. The API
  stores layouts without understanding them (validation stops at "a JSON object").
- **One error boundary and one `<Suspense>` per card**, so the blast radius of a crash matches the deployment unit
  and one slow `remoteEntry.js` does not hold the others back.

### Code
- TypeScript strict. No `any` in app code; `unknown` + narrowing at MF boundaries.
- Folder names kebab-case, components PascalCase, hooks `useX`.
- No global CSS from remotes (iter 6).
- Each remote must run **standalone** on its own port at all times.

## 7. Shared dependencies policy

Policy finalized in iter 1 ([ADR 0005](decisions/0005-shared-dependencies-policy.md)),
extended by later iterations:

| Package | singleton | requiredVersion | strictVersion | eager | Why |
|---|---|---|---|---|---|
| react | ✅ | `^` + installed version | ❌ (warn) | ❌ | hooks break with two copies |
| react-dom | ✅ | `^` + installed version | ❌ (warn) | ❌ | must match react |
| react-router | ✅ | `^` + installed version | ❌ (warn) | ❌ | router context must be single (iter 3) |
| @tanstack/react-query | ✅ | `^` + installed version | ❌ (warn) | ❌ | one QueryClient context (iter 5) |
| i18next, react-i18next | ✅ | `^` + installed version | ❌ (warn) | ❌ | one i18n instance (iter 7) |
| @mf/services (workspace) | ✅ | `^` + its `package.json` version | ❌ (warn) | ❌ | one service container context (iter 8) |

Rules:
- Every option is written explicitly in each `webpack.config.js`. `requiredVersion` is
  `` `^${require('<pkg>/package.json').version}` ``: webpack cannot infer it from `"catalog:"`
  and infers `*` for requests made from inside a package.
- Versions are aligned at build time with the pnpm catalog in `pnpm-workspace.yaml`; every app
  uses `"<pkg>": "catalog:"` for shared and build-toolchain dependencies.
- No `eager` and async bootstrap everywhere (section 6).
- Utility libraries (lodash, date-fns, etc.) are **not shared** by default: shared modules
  are not tree-shaken, so sharing a big utility lib can cost more than duplicating the parts used.
- Workspace packages are not shared, except `@mf/services`: its module holds a React context, whose identity must be
  one per page (iter 8). It exports `./package.json` for `requiredVersion`.
- Store libraries are not shared: store identity comes from the owner's exposed module (`cart/store`), and only the
  owner imports `zustand` (iter 5, [ADR 0009](decisions/0009-cart-store-exposed-by-owner.md)).
- Dev-only `window.__mfDebug()` in shell prints the share scope (package, version, provider, loaded).

## 8. State model (iter 5, [notes](notes/05-state.md))

| Kind | Tool | Owner |
|---|---|---|
| Server state / cache (products, orders, widgets data) | TanStack Query, single `QueryClient` | shell creates the client; key factories and query options in `packages/queries`, requests in `packages/api-client`; data owned by the API |
| Client shared state (cart items, mini-cart open) | Zustand, one instance in the owner's container | owner app exposes functions: cart → `cart/store` |
| Session (logged-in flag) | `createSession()`: `localStorage` flag + `useSyncExternalStore` | shell creates it, remotes resolve `SESSION_SERVICE` (iter 8) |
| Local UI state | `useState` / `useReducer` | each component |

## 9. Environments and config

- Dev: every app on its own port (section 2). Remote URLs: static in shell config until iter 9,
  then runtime `remotes.json` / API registry. Iteration 09 is deferred, so the dashboard's widget URLs are
  static too, although the API registry (`GET /widgets`) that will replace them already exists
  ([ADR 0015](decisions/0015-static-widget-remotes.md)).
- From iter 13: one build artifact per app, environment config injected at runtime
  (never baked in with build-time env vars).
- API base URL `http://localhost:4000` in dev. CORS allows the dev ports with credentials.
  Cookies are not port-scoped and all `localhost:*` ports are one site, so every app sends the auth cookies.
  `localStorage` is per origin: a standalone remote keeps its own session flag.
- Dev demo user: `services/api/src/auth/users.ts` (mirrored in `packages/api-client/src/dev-credentials.ts`).
  Access token TTL 30s (dev demo value).

## 10. Commands

| Command | What |
|---|---|
| `pnpm dev` | all apps + api |
| `pnpm dev --filter <app>...` | one app with its workspace deps |
| `pnpm build` | production build of everything |
| `pnpm typecheck` | `tsc --noEmit` in every package (after remotes emit their `types/`) |
| `pnpm lint` | ESLint everywhere; stylelint for CSS (iter 6) |
