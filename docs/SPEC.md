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
| shell | `apps/shell` | Host: layout, header, routing, auth, providers | 3000 | `shell` | (store/session, decided in iter 5/8) | 00 |
| catalog | `apps/catalog` | Remote: product list and product details | 3001 | `catalog` | `./App` (routes; `./ProductList` until iter 3) | 00 |
| cart | `apps/cart` | Remote: cart page, mini-cart widget, checkout | 3002 | `cart` | `./App`, `./CartWidget` | 00 |
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
| `/account/*` | account (protected from iter 8) |
| `/dashboard` | dashboard → widgets (protected from iter 8) |
| `/login` | shell |

Route constants (`ROUTES`) live in `packages/contracts` (from iter 3). No hardcoded URLs in links or redirects.
`/login` and `/dashboard` are added in iterations 08 and 10.

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
- **shell** owns: URL/history, top-level layout, auth session, QueryClient instance,
  i18n instance, theme, Sentry init. Remotes never create these when hosted.
- **Remotes** own: their routes below their prefix, their UI, their translations,
  their query hooks (using shared key factories).
- **dashboard** owns widget layout and widget loading; widget URLs come from the API registry.

## 4. Tech stack

Install **current stable** versions at the time of iteration 0 and record exact
versions in the PROGRESS.md entry. Versions are aligned across the workspace with
pnpm catalogs (from iter 1).

| Layer | Choice | Notes |
|---|---|---|
| Package manager | pnpm workspaces | `.nvmrc` pins Node.js active LTS |
| Monorepo tasks | Turborepo | `dev`, `build`, `typecheck`, `lint` pipelines |
| Bundler | Webpack 5 + `webpack.container.ModuleFederationPlugin` (classic) | No `@module-federation/*` packages until iter 16, except where an iteration explicitly allows it |
| Transpiling | `swc-loader` | Types checked separately with `tsc --noEmit` |
| Dev server | `webpack-dev-server` | `historyApiFallback: true`, CORS headers for remotes |
| UI | React + TypeScript (strict) | |
| Routing | React Router 8, package `react-router` (declarative mode) | iter 3, [ADR 0007](decisions/0007-react-router-8.md) |
| Server state | TanStack Query | single `QueryClient` from shell, iter 5 |
| Client shared state | Zustand | iter 5 |
| Styles | CSS Modules + CSS custom properties (tokens) | iter 6 |
| i18n (internationalization) | i18next + react-i18next | iter 7 |
| Backend | NestJS (in-memory data, no DB) | iter 5; auth in iter 8 |
| Auth | JWT (JSON Web Token) access token in memory + refresh token in httpOnly cookie | iter 8 |
| Containers | Docker Compose + nginx | iter 12 |
| CI | GitHub Actions | iter 12 |
| Observability | Sentry (⚠ open decision in iter 14) | iter 14 |
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
│  ├─ contracts/        # @mf/contracts — iter 3: route constants; iter 4+: props, events, query keys
│  ├─ tokens/           # iter 6: CSS custom properties
│  ├─ mf-runtime/       # iter 9: loadRemote(), remote config
│  └─ dev-harness/      # iter 13: standalone providers for remotes
├─ pnpm-workspace.yaml
├─ turbo.json
└─ tsconfig.base.json
```

Typical app layout:

```
apps/catalog/
├─ webpack.config.js    # explicit, no shared factory until there is a reason
├─ package.json
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
- Breaking changes to an exposed module require a new expose name (`./ProductListV2`)
  — see contracts rules (iter 4).
- Types of remote modules (iter 2, [ADR 0006](decisions/0006-remote-types.md)): the host's `tsconfig.json`
  maps each remote prefix to the remote's exposed sources (`"catalog/*": ["../catalog/src/exposed/*"]`) and the
  host lists each remote in `devDependencies` as `"<remote>": "workspace:*"` (so Turborepo invalidates the host's
  typecheck when a remote changes). Props types are named exports next to the exposed component.
  No ambient `declare module '<remote>/*'` stubs.

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
| zustand | ✅ | `^` + installed version | ❌ (warn) | ❌ | store identity (iter 5) |
| i18next, react-i18next | ✅ | `^` + installed version | ❌ (warn) | ❌ | one i18n instance (iter 7) |

Rules:
- Every option is written explicitly in each `webpack.config.js`. `requiredVersion` is
  `` `^${require('<pkg>/package.json').version}` ``: webpack cannot infer it from `"catalog:"`
  and infers `*` for requests made from inside a package.
- Versions are aligned at build time with the pnpm catalog in `pnpm-workspace.yaml`; every app
  uses `"<pkg>": "catalog:"` for shared and build-toolchain dependencies.
- No `eager` and async bootstrap everywhere (section 6).
- Utility libraries (lodash, date-fns, etc.) are **not shared** by default: shared modules
  are not tree-shaken, so sharing a big utility lib can cost more than duplicating the parts used.
- Dev-only `window.__mfDebug()` in shell prints the share scope (package, version, provider, loaded).

## 8. State model (summary, detailed in iter 5)

| Kind | Tool | Owner |
|---|---|---|
| Server state / cache (products, orders, widgets data) | TanStack Query, single `QueryClient` | created by shell; query key factories in `packages/contracts` |
| Client shared state (cart items, mini-cart open, session snapshot) | Zustand, single store instance | decided in iter 5 (ADR) |
| Local UI state | `useState` / `useReducer` | each component |

## 9. Environments and config

- Dev: every app on its own port (section 2). Remote URLs: static in shell config until iter 9,
  then runtime `remotes.json` / API registry.
- From iter 12: one build artifact per app, environment config injected at runtime
  (never baked in with build-time env vars).
- API base URL `http://localhost:4000` in dev. CORS allows the dev ports with credentials.
  Note: cookies are not port-scoped, so all `localhost:*` apps share them.

## 10. Commands

| Command | What |
|---|---|
| `pnpm dev` | all apps + api |
| `pnpm dev --filter <app>...` | one app with its workspace deps |
| `pnpm build` | production build of everything |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm lint` | ESLint everywhere |
| `pnpm check:exposes` | contract check of remote exposes (from iter 4) |
