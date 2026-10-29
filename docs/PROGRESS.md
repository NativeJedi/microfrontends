# PROGRESS

**Current iteration:** 10 — Nested micro-frontends: dashboard + widgets (`todo`; 09 deferred, see the latest entry)

Newest entry on top. One entry per session. Keep entries short: the next agent reads only the latest one.

## Entry template

```md
### YYYY-MM-DD — Iteration NN — Title
- Status: done | in progress | blocked
- Done: <what was built, 3–6 bullets>
- Walkthrough: <problems explained to the user, see notes>
- Decisions: <ADR links>
- Deviations from SPEC/ROADMAP: <none | what and why>
- Known issues / tech debt: <...>
- Versions: <only in iteration 00 or when a dependency changed>
- Next session starts with: <concrete first step>
```

## Entries

### 2026-10-29 — Iteration 09 — Resilience + manual dynamic remote loading
- Status: deferred — implemented on a branch, not merged
- Done:
  - Implemented and verified on branch `feat/iteration-09-resilience` (commit `0d95530`, PR open, not merged):
    `@mf/runtime` with a hand-written `loadRemote`, runtime `remotes.json`, `RemoteSlot` per remote,
    ADR 0014 and `docs/notes/09-resilience.md`. None of it is on `main`.
  - `main` keeps the static `remotes` of iteration 08.
- Walkthrough: done in the session; the notes exist only on the branch.
- Decisions: the user deferred the iteration — the hand-written runtime (~380 lines of code, roughly half of
  it beyond the ROADMAP scope) was judged over-engineered for now. Postponed rather than simplified.
- Deviations from SPEC/ROADMAP:
  - Iteration 09 skipped for now; iteration 10 starts on static remotes.
  - SPEC still describes the iteration-09 plan (`mf-runtime`, runtime `remotes.json`); unchanged on purpose.
- Known issues / tech debt:
  - Iteration 10 depends on `loadRemote`: with static remotes its criterion "adding a registry entry (no
    dashboard rebuild) shows a new widget" and the per-widget timeout cannot be met. Record them as not met
    in iteration 10, do not weaken them.
  - Still open from iteration 08: re-check "three simultaneous 401s → one refresh" with three apps on one
    screen, and protect `/dashboard`.
- Next session starts with: iteration 10 on static remotes — confirm with the user what the three widgets
  show before writing their UI. If 09 is revisited, start from the branch.

### 2026-10-19 — Iteration 08 — Auth and session
- Status: done
- Done:
  - api: `POST /auth/login|refresh|logout` (204 + cookies). Access JWT 30s in an httpOnly `access_token` cookie;
    opaque rotating `refresh_token` (`Path=/auth`) with reuse detection (family revoked). Global guard with
    `@AuthMode` (orders required, products optional, auth none). A failed refresh clears the cookies.
  - `@mf/api-client`: `createSession()` (`auth:is-logged-in` flag + `storage` event), `createApiClient(session)`
    (`credentials: 'include'`, single-flight refresh, one retry, 401 after refresh → logout). Request functions and
    `@mf/queries` take the client (`productQueries.list(api)`). Keys `API_CLIENT_SERVICE`, `SESSION_SERVICE`.
  - New `@mf/services`: generic service container (string keys, `register`/`resolve`, `ServicesProvider`,
    `useService`), an MF shared singleton in all four apps. Expose props unchanged.
  - shell: `/login?returnTo=` (same-app paths only), `RequireAuth` on `/account/*`, Log in/Log out,
    `useSessionCleanup` (`queryClient.clear()` + `shell:logged-out`). Cart clears its store on that event and shows
    "Log in to place an order". Standalone cart/account: dev login.
  - Verified in the browser:
    - `/account` → login → back.
    - `/orders` + `/products` 401 → one `/auth/refresh` → both retried 200.
    - Logout in one tab logs out the other (redirect, `Cart (0)`).
    - API restart → refresh 401 → logged out, anonymous catalog works.
    - Cart login → return → order placed.
    - Standalone :3001–:3003 work. One `@mf/services` in `__mfDebug()`.
- Walkthrough: per-app refresh vs rotation (three parallel `curl` refreshes: one 204, two 401, winner revoked), context
  or key identity across bundles, logout across tabs, cross-tab refresh race, cookies/CORS across origins and sites —
  see `docs/notes/08-auth.md`.
- Decisions: [ADR 0013 — auth session](decisions/0013-auth-session.md) (partly supersedes ADR 0009/0010 delivery).
- Deviations from SPEC/ROADMAP:
  - Access token in an httpOnly cookie, not in memory.
  - Session = `localStorage` flag, no `/me`.
  - Cross-tab logout via the `storage` event instead of BroadcastChannel.
  - Services reach remotes through a shared DI container, not props or a `shell/session` expose.
  - Acceptance "three simultaneous 401s from different apps" is **partially met**: until the dashboard (iter 10) at
    most two apps request on one screen. Verified with two apps (account + cart) → exactly one refresh; re-check
    with three apps in iteration 10.
  - `/dashboard` protection moves to iteration 10 (the route does not exist yet).
- Known issues / tech debt:
  - No cross-tab single-flight: two tabs refreshing at once revoke the session (Web Locks or a server grace period).
  - Refresh tokens are in memory, so an API restart logs everyone out.
  - Dev JWT secret is a constant (runtime config in iter 13).
  - `useService` failure without a shared `@mf/services` was not reproduced in the browser.
- Versions: `@nestjs/jwt` 12.0.3, `cookie-parser` 1.4.7, `@types/cookie-parser` 1.4.10, `@types/express` 5.0.6;
  `@mf/services` 1.0.0.
- Next session starts with: iteration 09 — resilience + manual dynamic remote loading.

### 2026-10-17 — Iteration 07 — i18n
- Status: done
- Done:
  - `i18next` + `react-i18next` MF singletons in all apps. `@mf/i18n` (stateless): `createI18n` (separate instance,
    namespace loader backend, `fallbackLng: false`), `useNamespaceTranslation(ns, loader)`, languages `en`/`uk`.
  - Shell creates the only instance in `bootstrap.tsx` (`<I18nextProvider>`), owns the language (`LanguageSwitcher`,
    `shell:language`, `<html lang>`), translates its texts and the `CartWidget` label.
  - catalog/cart/account: one namespace each, `src/i18n/locales/{en,uk}.json` loaded via `import()` → chunks from their
    own origin; standalone bootstraps create their own instance. Prices/dates via i18next `Intl` formatters, uk plurals.
  - Verified in the browser: live switch everywhere with no fallback flash, one locale request per app per language
    (lazy, from :3000–:3003, none when switching back), `shell:language` survives reload, one i18next/react-i18next in
    `__mfDebug()`, standalone :3001–:3003, clean console; production build served statically behaves the same.
- Walkthrough: last `init` wins (confirmed by script: language reset, shell bundle wiped), locales from the host origin
  (`404` for a root-relative URL; `ChunkLoadError` with `publicPath: '/'`, confirmed and reverted) — see
  `docs/notes/07-i18n.md`.
- Decisions: [ADR 0012 — i18n ownership](decisions/0012-i18n-ownership.md).
- Deviations from SPEC/ROADMAP: the planned "remote `addResourceBundle` + Suspense + `startTransition`" approach was
  replaced by a loader backend: react-i18next 17 updates through `useSyncExternalStore`, so the transition could not
  prevent the Suspense fallback on a language switch (confirmed). `resolveJsonModule` added to `tsconfig.base.json`.
- Known issues / tech debt: untyped translation keys (no `CustomTypeOptions`), no fallback language (missing key →
  key shown); standalone remotes have no language switch (iter 14); API content untranslated; locale chunks have no
  content hash (iter 11); `webpack serve --mode production` (not a project command) failed to render the shell with
  `Cannot read properties of undefined (reading 'call')` — not investigated, `pnpm build` output works.
- Versions: `i18next` 26.4.7, `react-i18next` 17.0.20 (pnpm catalog).
- Next session starts with: iteration 08 — auth and session.

### 2026-10-17 — Iteration 06 — Style isolation
- Status: done
- Done:
  - CSS Modules in all apps: `css-loader` `localIdentName: '<app>__[local]__[hash:base64:5]'`, `style-loader` in dev,
    `MiniCssExtractPlugin` in production (configs became `(env, argv) => ({…})`); all inline styles replaced;
    `src/css.d.ts` per app. catalog and cart both define `.button` → `catalog__button__*` / `cart__button__*`.
  - `@mf/tokens`: `--mf-*` custom properties, dark values on `:root[data-theme='dark']`. Shell loads tokens + the only
    reset (`global.css`) and owns the theme (`ThemeToggle`, `use-theme.ts`, `shell:theme`); remotes use `var()` with
    fallbacks and import tokens only in standalone bootstrap.
  - stylelint (`stylelint.config.js`) in `pnpm lint`: no type/universal/id selectors, `:global`, `:root`,
    `@font-face`, `@import` in remote CSS Modules; no selectors in plain `.css` in remotes.
  - Verified in the browser: prefixed classes, theme switch across shell/catalog/cart widget/mini-cart/account, theme
    survives reload, standalone :3001–3003 get tokens, clean console; production build: remote `.css` chunks as
    `<link>` from :3001–:3003 (three `858.css` coexist).
- Walkthrough: load-order conflict of global `.button`/reset; styles of an unmounted remote stay in `<head>` (confirmed
  in dev and production) — see `docs/notes/06-styles.md`.
- Decisions: [ADR 0011 — style isolation](decisions/0011-style-isolation.md).
- Deviations from SPEC/ROADMAP: Shadow DOM demo not built (user decision) — trade-offs in notes and ADR; local `main`
  reset to `origin/main` (`ca9241f`, iteration 05 squash-merged via PR #1, same tree as the branch).
- Known issues / tech debt: CSS not minified in production (iteration 11); theme applied after first render (brief light
  flash with a stored dark theme); remotes duplicate token fallbacks.
- Versions: `css-loader` 7.1.5, `style-loader` 4.0.0, `mini-css-extract-plugin` 2.10.2 (pnpm catalog), `stylelint`
  17.16.0 (root).
- Next session starts with: iteration 07 — i18n.

### 2026-10-15 — Iteration 05 — State: TanStack Query + Zustand
- Status: done
- Done:
  - `services/api` (NestJS, in-memory, :4000): products and orders endpoints, CORS for :3000–3003 with credentials;
    runs in `pnpm dev` / `pnpm build`.
  - `@tanstack/react-query` MF singleton in all apps; one `QueryClient` in shell `bootstrap.tsx`, standalone
    bootstraps create their own. Stateless packages: `@mf/api-client` (API types, request functions) and
    `@mf/queries` (`productKeys`/`orderKeys`, `queryOptions` with `staleTime`); `@mf/contracts` keeps routes and events. Mock data removed from catalog, cart and account.
  - Cart store (Zustand + `persist` to `cart:items`) owned by cart, exposed as `cart/store` (`addToCart`,
    `useCartQuantity`); catalog consumes it (`remotes: { cart }`); `CartWidget` = header counter + mini-cart.
  - Place order in cart → `invalidateQueries(orderKeys.all)` → account orders refetch on mount.
  - Verified in the browser: instant header counter, one `GET /products` across catalog ↔ cart, new order in account
    without reload, cart survives refresh, one react-query in `__mfDebug()`, standalone remotes, clean console.
- Walkthrough: react-query not shared (`No QueryClient set, use QueryClientProvider to set one`, confirmed), store module
  not shared (confirmed via a direct file import: "(2 in cart)" vs "Cart (0)"), host client defaults, remote → remote
  dependency, localStorage per origin — see `docs/notes/05-state.md`.
- Decisions: [ADR 0009 — cart store exposed by its owner](decisions/0009-cart-store-exposed-by-owner.md);
  [ADR 0010 — stateless api-client and queries packages](decisions/0010-api-client-and-queries-packages.md) (for iter 08:
  the stateful HTTP client is created by the shell and passed to remotes through props); ADR 0003 updated.
- Deviations from SPEC/ROADMAP: option C (user decision) instead of A/B — cart owns and exposes the store; `zustand`
  removed from the shared table (only cart imports it); the header counter is cart's `CartWidget`; keys and `queryOptions`
  live in `@mf/queries` instead of `packages/contracts` (user decision, ADR 0010); API request body narrowed by hand instead of
  class-validator (no extra dependency); `turbo.json` `types` depends on `^types`.
- Known issues / tech debt: catalog imports `cart/store` statically — cart down breaks catalog (iteration 09);
  API responses are typed, not validated; API base URL is a constant in `@mf/api-client` (iteration 13); persisted cart is not
  synced across tabs.
- Versions: `@tanstack/react-query` 5.104.3, `zustand` 5.0.15 (pnpm catalog); `@nestjs/common`/`core`/`platform-express`
  12.1.3, `@nestjs/cli` 12.0.8, `reflect-metadata` 0.2.2, `rxjs` 7.8.2, `@types/node` 24.19.2 (api only).
- Next session starts with: iteration 06 — style isolation.

### 2026-10-15 — Iteration 04 — Contracts between micro-frontends
- Status: done
- Done:
  - Remotes own the props types of their exposes: `tsconfig.types.json` + `types` task emit `src/exposed` declarations
    into `types/` (gitignored); `package.json` `exports` maps every expose. Shell: `paths` removed, imports resolve through
    the `workspace:*` remote packages. Turbo: `typecheck` → `^types`; `build` no longer depends on `^build`.
  - cart `./CartWidget` takes a required `label` prop (`CartWidgetProps`); shell passes `label="Cart"`.
  - `@mf/contracts`: `MF_EVENTS`, `dispatchMfEvent` / `subscribeToMfEvent`, `catalog:product-viewed`
    (catalog product page → shell "Recently viewed" link).
  - Verified no remote code in shell's production `dist`.
  - Verified: browser (cart widget, recently viewed link, standalone remotes, clean console), renaming `label` in cart
    fails shell typecheck (TS2322), missing `exports` entry → TS2307.
- Walkthrough: renamed prop with independent deploy, host newer than deployed remote (real
  `Module "./CartWidgetV2" does not exist in container.` from dev servers started before a new expose), event before
  subscription, types artifact vs `exports` — see `docs/notes/04-contracts.md`.
- Decisions: [ADR 0008 — contracts between micro-frontends](decisions/0008-contracts-between-micro-frontends.md)
  (supersedes ADR 0006).
- Deviations from SPEC/ROADMAP: props types come from the remote's emitted declarations instead of `packages/contracts`
  (user decision: types live with the implementation, as in a polyrepo); `pnpm check:exposes` dropped (a script in the
  consumer's CI cannot catch a provider rollback) — replaced by new iteration 12 "Contract testing" (to be planned);
  iterations 12–16 renumbered to 13–17; the ROADMAP problem uses cart instead of catalog (catalog's `./App` has no props);
  the dev-only runtime guard (zod) was built and then removed (user decision): between own apps it only improves the
  error message for a local mismatch — types, compatibility rules, contract testing (12) and error boundaries (09)
  cover the risks; runtime validation is kept for untrusted inputs. The V2-expose demo (breaking change via
  `./CartWidgetV2` + `@deprecated` adapter) was built and removed (user decision: not MF-specific); the rule stays in SPEC.
- Known issues / tech debt: every expose is listed twice (webpack `exposes` + package `exports`); remotes must run `types`
  before the IDE sees their declarations in a fresh clone (`pnpm typecheck` does it); a remote change still marks the shell
  as affected in the monorepo (iteration 13); no error boundary yet (iteration 09).
- Next session starts with: iteration 05 — present store sharing options A vs B (⚠ open decision) before implementing.

### 2026-10-15 — Iteration 03 — Routing
- Status: done
- Done:
  - React Router 8 (`react-router`, pnpm catalog `^8.4.0`) shared as a singleton in every app.
  - shell: the only `<BrowserRouter>`, routes `/` → `/catalog`, `/catalog/*`, `/cart/*`, `/account/*`, 404; header
    nav + `cart/CartWidget`; `publicPath: '/'`.
  - catalog `./App` (list, `:productId`), cart `./App` (+ `./CartWidget`), new `apps/account` (:3003, `./App`:
    profile, orders); `./ProductList` expose removed. Standalone bootstraps own a router under the same prefix.
  - `packages/contracts` (`@mf/contracts`): `ROUTES`; all links and redirects use it. Remotes' standalone HTML uses
    an absolute `/main.js` (`HtmlWebpackPlugin({ publicPath: '/' })`).
  - Verified in the browser: deep-link refresh on every route, back/forward across apps, standalone remotes,
    one `react-router` in `__mfDebug()`; grep shows URL literals only in contracts.
- Walkthrough: router not shared, nested `BrowserRouter` (shared and not shared), relative `main.js` on deep links,
  relative links in splat routes — exact texts confirmed by uncommitted experiments, see `docs/notes/03-routing.md`.
- Decisions: [ADR 0007 — React Router 8](decisions/0007-react-router-8.md)
- Deviations from SPEC/ROADMAP: `react-router` 8 instead of `react-router-dom` (no v8 of it); `/` redirects to `/catalog`
  instead of rendering catalog at `/` (one mount point per remote); links inside remotes use `ROUTES` instead of
  relative paths (splat-route resolution); `/login` and `/dashboard` left for iterations 08 / 10.
- Known issues / tech debt: no error boundary per route yet (a broken remote blanks the shell — iteration 09);
  standalone "foreign URL" placeholder duplicated in each remote bootstrap (dev-harness, iteration 14);
  remotes' standalone `index.html` also includes `remoteEntry.js` as a script (harmless, revisit in iteration 11).
- Next session starts with: iteration 04 — move boundary types (props) into `@mf/contracts` and define compatibility rules.

### 2026-10-15 — Iteration 02 — Types for remotes
- Status: done
- Done:
  - catalog's `./ProductList` takes a required `title` prop; `ProductListProps` exported as a named type.
  - shell `tsconfig.json` `paths`: `catalog/*` → `../catalog/src/exposed/*`, `cart/*` → `../cart/src/exposed/*`;
    stub `apps/shell/src/remotes.d.ts` deleted.
  - shell `devDependencies`: `catalog` / `cart` as `workspace:*` so `shell#typecheck` depends on the remotes'
    typecheck in Turborepo (without it a remote-only change replays a cached green run — confirmed).
  - Verified: renaming `title` fails `pnpm typecheck` in shell (TS2322), an optional prop passes, no catalog code in
    the shell bundle, all three apps render in the browser with no console errors.
- Walkthrough: ambient stub → silent runtime bug; Turborepo cache false green; build-time vs deploy-time drift —
  see `docs/notes/02-remote-types.md`.
- Decisions: [ADR 0006 — types for remote modules](decisions/0006-remote-types.md)
- Deviations from SPEC/ROADMAP: no prototype of approach B (user decision: ready solution + description of
  approaches instead); ROADMAP scope and the open decision rewritten accordingly.
- Known issues / tech debt: shell build now waits for remote builds (`^build`), and in iteration 13 every remote change
  marks shell as affected — revisit when boundary types move to `packages/contracts` (iteration 04).
- Next session starts with: iteration 03 — add `apps/account` (:3003) and `react-router-dom` as a singleton.

### 2026-10-14 — Iteration 01 — Shared dependencies and versioning
- Status: done
- Done:
  - Process change (user request): no reproduce commits / problem tags; solve, then walk through the
    "Problems" block. CLAUDE.md, SPEC section 1, ROADMAP, notes and PROGRESS templates updated.
  - pnpm catalog in `pnpm-workspace.yaml`; all apps use `catalog:` for React, types and build toolchain.
  - `react` / `react-dom`: `singleton: true`, explicit `requiredVersion: ^<installed>`, `strictVersion: false`.
  - Dev-only `window.__mfDebug()` in shell: shows one React 19.3.0 provided by shell and loaded.
- Walkthrough: two React copies, version mismatch (strict vs non-strict, singleton vs not), missing async
  bootstrap — exact error texts confirmed by local uncommitted experiments, see `docs/notes/01-shared-deps.md`.
- Decisions: [ADR 0005 — shared dependencies policy](decisions/0005-shared-dependencies-policy.md)
- Deviations from SPEC/ROADMAP: `requiredVersion` is taken from the installed package, not from
  `package.json` (`catalog:` is not a semver range). ROADMAP problem 3 reworded: the eager-consumption
  error comes from a missing async bootstrap; `eager: true` hides it.
- Known issues / tech debt: no error boundary, so a strict mismatch or a broken remote blanks the shell
  (iteration 09); mismatch warnings only in console (iteration 15).
- Next session starts with: iteration 02 — implement approach A
  (types exported from catalog/cart packages, consumed by shell via `paths`).

### 2026-10-14 — Iteration 00 — Skeleton
- Status: done
- Done:
  - Monorepo root: pnpm workspace, Turborepo (`dev`/`build`/`typecheck`/`lint`), `tsconfig.base.json`,
    ESLint 9 flat config, Prettier, `.nvmrc` (24), `.editorconfig`.
  - `apps/catalog` (:3001, exposes `./ProductList`), `apps/cart` (:3002, exposes `./CartWidget`),
    `apps/shell` (:3000, static remotes, `React.lazy` + `Suspense`).
  - Async bootstrap in every app; `shared: { react: {}, 'react-dom': {} }` as specified.
  - Temporary `declare module 'catalog/*'` / `'cart/*'` in `apps/shell/src/remotes.d.ts`.
  - Verified in the browser: shell shows both remotes, each remote runs standalone, `window.catalog.init/get`
    are functions, no console errors. `pnpm build`, `pnpm typecheck`, `pnpm lint` pass.
- Reproduced: n/a (no reproduce block in this iteration).
- Decisions: [ADR 0004 — toolchain versions](decisions/0004-toolchain-versions.md)
- Deviations from SPEC/ROADMAP: TypeScript 6.0.3 and ESLint 9.39 instead of `latest` (TS 7 / ESLint 10),
  because typescript-eslint and eslint-plugin-react do not support them yet (see ADR 0004).
- Known issues / tech debt: no React Fast Refresh (HMR falls back to full reload); `jsx-runtime` and
  `react-dom/client` are not shared (see notes, to be checked in iteration 01); `@swc/core` build script
  is skipped by pnpm 10 (not needed); CORS is `*` in dev.
- Versions: Node 24.0.1, pnpm 10.14.0, react / react-dom 19.3.0, webpack 5.111.1, webpack-cli 7.2.3,
  webpack-dev-server 6.0.0, html-webpack-plugin 5.6.8, swc-loader 0.2.7, @swc/core 1.16.18,
  typescript 6.0.3, eslint 9.39.5, typescript-eslint 8.71.2, eslint-plugin-react 7.37.5,
  eslint-plugin-react-hooks 7.1.1, prettier 3.9.10, turbo 2.11.8, @types/react(-dom) 19.3.0.
- Next session starts with: iteration 01 — branch `iter/01-shared-deps`; first reproduce failure #1
  (remove `react` from `shared` in cart and use a hook in `CartWidget`).
