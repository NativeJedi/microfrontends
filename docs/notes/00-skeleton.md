# 00 — Skeleton

> Challenge: — · Tags: `iter-00-done` (no `iter-00-problem`: this iteration has no reproduce block)

## Problem
Before any micro-frontend challenge can be reproduced, there must be a working baseline: a host
application that loads UI from two independently built and served applications at runtime. This
iteration builds that baseline with the classic Webpack 5 Module Federation (MF) plugin.

## How we reproduced it
Not applicable. Observed baseline behavior instead:
- `pnpm dev` starts shell (`:3000`), catalog (`:3001`), cart (`:3002`) through Turborepo.
- `localhost:3000` shows the catalog product list and the cart widget; browser console has no errors.
- `localhost:3001` and `localhost:3002` render each remote standalone.
- The shell page requests `http://localhost:3001/remoteEntry.js` and `http://localhost:3002/remoteEntry.js`.
- In the shell page `window.catalog` and `window.cart` are objects with `init` and `get` functions.

## Root cause
Not applicable. Key mechanics below.

### Host vs remote
- **Host** (shell) consumes modules from other builds: `remotes: { catalog: 'catalog@http://localhost:3001/remoteEntry.js' }`.
  Format is `<global variable name>@<url of the container script>`.
- **Remote** (catalog, cart) publishes modules: `exposes: { './ProductList': './src/exposed/ProductList.tsx' }`.
- A build can be both (dashboard in iteration 10).
- `import('catalog/ProductList')` in the host is not a normal chunk import: webpack replaces it with a
  call into the `catalog` container.

### What is inside `remoteEntry.js`
It is a small script that defines a global variable (`var catalog`) holding a **container** with two
functions (seen in `apps/catalog/dist/remoteEntry.js`):
- `init(shareScope)` — receives the shared scope from the host (the registry of shared libraries such as
  react), stores it in `__webpack_require__.S` and registers the remote's own shared modules into it.
  Throws "Container initialization failed as it has already been initialized with a different share
  scope" if called with a different scope.
- `get(module)` — returns a Promise of a **factory** for an exposed module. For `./ProductList` it is
  `() => r.e(310).then(() => () => r(310))`: load the chunk that contains the module, then return a
  function that evaluates it. Unknown module → `Module "…" does not exist in container.`

`remoteEntry.js` itself contains only the container and the webpack runtime, not the exposed code:
the exposed modules live in separate chunks loaded on demand from the remote's own origin
(`publicPath: 'auto'` resolves the URL from the script that was loaded).

The host does, in essence: load script → `container.init(shareScope)` → `container.get('./ProductList')`
→ call the factory → get the module. The plugin generates this for `remotes`; iteration 09 writes it by hand.

### `exposes` / `remotes` / `shared`
| Option | Used in | Meaning |
|---|---|---|
| `exposes` | remote | Public modules of the container: expose name → local file |
| `remotes` | host | Where to find other containers: local alias → `name@url` |
| `shared` | both | Libraries negotiated at runtime through the share scope so that one copy is used |

### Async bootstrap
`src/index.ts` is only `import('./bootstrap')`. The extra async boundary gives webpack time to initialize
the share scope (load remote containers, pick shared versions) before any code that imports `react` runs.
Without it, an entry that imports a shared module synchronously fails with "Shared module is not available
for eager consumption" (reproduced on purpose in iteration 01).

## Solution
- Monorepo: pnpm workspaces + Turborepo (`dev`, `build`, `typecheck`, `lint`), one TypeScript base config,
  ESLint 9 flat config, Prettier.
- Each app has an explicit `webpack.config.js`: `swc-loader` for TS/TSX, `html-webpack-plugin`,
  `ModuleFederationPlugin`, dev server with `historyApiFallback` and `Access-Control-Allow-Origin: *`
  (the shell loads scripts from another origin).
- `shared: { react: {}, 'react-dom': {} }` — intentionally minimal: no `singleton`, no `eager`.
- Temporary `declare module 'catalog/*'` / `'cart/*'` in `apps/shell/src/remotes.d.ts` (replaced in iteration 02).

## Observations to carry into iteration 01
- The production build log shows only `react@^19.3.0` and `react-dom@*` as consumed shared modules. The
  entry points that this config does **not** share are `react/jsx-runtime` and `react-dom/client`: each app
  bundles its own copy of them. They import `react`, which is shared, so one React instance is expected, but
  this was not verified here. Check it with the share-scope debug helper.
- `react-dom` is reported with `requiredVersion: *` while `react` gets `^19.3.0`, although both are in the
  app's `package.json`. To be explained when versions are made explicit.
- `__webpack_share_scopes__` is not a browser global, so the share scope cannot be inspected from the console;
  the debug helper must run inside the bundle.
- pnpm 10 skips `@swc/core` install script; it was not needed (platform binary comes as an optional dependency).

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| Explicit `webpack.config.js` per app (chosen) | Every line is readable; each app is independent | Repeated loader/devServer config across apps |
| Shared webpack config factory | Less duplication | Hides MF config, which is the learning goal |
| Static remote URLs in shell config (chosen for now) | Simplest possible wiring | Rebuild to change a URL; a down remote breaks the shell (fixed in iteration 09) |
| `Access-Control-Allow-Origin: *` in dev | Works for any host port | Too open for production; narrowed in iteration 12 |

## Interview questions
- **Q:** What is the difference between host and remote?
  **A:** The host consumes modules from other containers (`remotes`), the remote publishes modules
  (`exposes`). A build can play both roles.
- **Q:** What is in `remoteEntry.js`?
  **A:** A container with `init(shareScope)` and `get(module)`; the exposed code is in separate chunks.
- **Q:** Why is an async bootstrap needed?
  **A:** Shared modules must be negotiated before the first import of them is evaluated; an async
  boundary lets webpack do that. Otherwise: "Shared module is not available for eager consumption".
- **Q:** Why `publicPath: 'auto'` in a remote?
  **A:** Chunks of the remote must be fetched from the remote's origin, not from the host's.

## Links
- Webpack Module Federation: https://webpack.js.org/concepts/module-federation/
- `ModuleFederationPlugin`: https://webpack.js.org/plugins/module-federation-plugin/
