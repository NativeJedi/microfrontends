# PROGRESS

**Current iteration:** 04 — Contracts between micro-frontends (`todo`)

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
  standalone "foreign URL" placeholder duplicated in each remote bootstrap (dev-harness, iteration 13);
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
- Known issues / tech debt: shell build now waits for remote builds (`^build`), and in iteration 12 every remote change
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
  (iteration 09); mismatch warnings only in console (iteration 14).
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
