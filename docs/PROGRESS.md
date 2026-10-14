# PROGRESS

**Current iteration:** 01 — Shared dependencies and versioning (`todo`)

Newest entry on top. One entry per session. Keep entries short: the next agent reads only the latest one.

## Entry template

```md
### YYYY-MM-DD — Iteration NN — Title
- Status: done | in progress | blocked
- Done: <what was built, 3–6 bullets>
- Reproduced: <errors observed, exact text>
- Decisions: <ADR links>
- Deviations from SPEC/ROADMAP: <none | what and why>
- Known issues / tech debt: <...>
- Versions: <only in iteration 00 or when a dependency changed>
- Next session starts with: <concrete first step>
```

## Entries

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
