# 03 — Routing

> Challenge: #5

## Problem
In a micro-frontend app several independently built bundles render on one page, but the browser has one URL
and one history. Someone must own them. If every remote brings its own router, the apps disagree about the
current location, the back button stops matching what is on screen, and deep links depend on which bundle
happens to handle them. Remotes also need URLs of other apps (catalog → cart), and hardcoded strings break as
soon as a route changes.

## Solution
- **React Router 8** (`react-router`, one package; `react-router-dom` is not released for v8) — see
  [ADR 0007](../decisions/0007-react-router-8.md). Shared as an MF singleton in every app:
  ```js
  'react-router': { singleton: true, requiredVersion: `^${reactRouterVersion}`, strictVersion: false },
  ```
- **Shell owns the URL**: the only `<BrowserRouter>` (in `bootstrap.tsx`) and the top-level routes. Each remote is
  mounted under its prefix with a splat:
  ```tsx
  <Route path={ROUTES.home} element={<Navigate to={ROUTES.catalog.root} replace />} />
  <Route path={`${ROUTES.catalog.root}/*`} element={<CatalogApp />} />
  <Route path={`${ROUTES.cart}/*`} element={<CartApp />} />
  <Route path={`${ROUTES.account.root}/*`} element={<AccountApp />} />
  <Route path="*" element={<NotFoundPage />} />
  ```
- **Remotes expose `./App`** with **relative** `<Routes>` and no router of their own:
  catalog (`index` list, `:productId` details), cart (`index` cart page; `./CartWidget` stays for the header),
  account (new remote, :3003: `profile`, `orders`, `index` → redirect). `./ProductList` is no longer exposed.
- **Standalone**: each remote's `bootstrap.tsx` wraps `<App />` in its own `<BrowserRouter>`, mounts it under the
  same prefix as the shell and shows a placeholder for URLs owned by other apps.
- **`packages/contracts`** (`@mf/contracts`, new): `ROUTES` constants. Every link and redirect uses them:
  `ROUTES.catalog.product(id)`, `ROUTES.cart`, `ROUTES.account.orders`. It is a plain workspace dependency
  bundled into each app (constants have no state, so copies are harmless).
- **Deep links**: shell `output.publicPath: '/'`; remotes keep `publicPath: 'auto'` for chunks and set
  `publicPath: '/'` only in `HtmlWebpackPlugin` for their standalone page. `historyApiFallback: true` (since iter 00).

Verified in the browser:
- refresh on `/`, `/catalog`, `/catalog/p2`, `/catalog/zzz`, `/cart`, `/account`, `/account/profile`,
  `/account/orders`, `/nope` renders the right page;
- catalog → cart → catalog → back → back → forward, account → orders → catalog → back: URL and screen match;
- remotes standalone on :3001 / :3002 / :3003 (deep links, own navigation, placeholder for foreign URLs);
- `__mfDebug()`: `react`, `react-dom`, `react-router 8.4.0` — each once, provided by shell, loaded.

Grep check (no cross-app URL literals): `grep -rnE "['\"\`]/(catalog|cart|account)" apps/*/src packages/contracts/src`
matches only `packages/contracts/src/routes.ts`.

## How it works

### One router, many `<Routes>`
`<BrowserRouter>` creates a history object (wrapper over `window.history` + `popstate`) and puts the location and a
`navigator` into React contexts. `<Routes>` anywhere below reads those contexts. Because `react-router` is a
singleton, the module that created the contexts in the shell is the same module that catalog's `<Routes>` and
`<Link>` read from — so remotes see the shell's location and navigate through the shell's history.

### Descendant routes
The shell route `/catalog/*` matches `/catalog/p2` with `pathnameBase = /catalog` and splat `p2`. The `<Routes>`
inside catalog's `App` is a *descendant* `<Routes>`: it matches only the remaining part (`p2`) against its relative
routes (`index`, `:productId`). So the remote does not know or care where it is mounted. The trailing `/*` in
the shell is required: without it the parent stops matching as soon as the URL goes deeper.

### Why links use `ROUTES` even inside a remote
Route definitions are relative, but relative *links* inside a splat route resolve against the **whole** matched
URL, including the splat (default since React Router 7, previously the `v7_relativeSplatPath` future flag). A
`<NavLink to="orders">` rendered by account's `App` at `/account/profile` therefore points to
`/account/profile/orders` (see problem 4). Absolute links from contracts are unambiguous and grep-able.

### Where `publicPath` matters
- `output.publicPath` is the prefix for chunks and for the script tags that `HtmlWebpackPlugin` writes.
- `'auto'` computes it at runtime from the URL of the running script (`document.currentScript`): that is what lets
  catalog's chunks load from `:3001` while the page is on `:3000`. In `index.html` it becomes a *relative*
  `src="main.js"`.
- The shell is always served from `/`, so `'/'` is correct for it. Remotes need both: `'auto'` for chunks and an
  absolute `/main.js` in their standalone page — hence `new HtmlWebpackPlugin({ ..., publicPath: '/' })`.

### Contracts package wiring
`@mf/contracts` exports TypeScript source (`"exports": { ".": "./src/index.ts" }`). webpack follows the pnpm
symlink to `packages/contracts/src`, which is not under `node_modules`, so `swc-loader` compiles it;
`tsc` reads it through `moduleResolution: "Bundler"`. Not shared through MF: no state, tiny, and bundling keeps
each app's constants fixed at build time.

## What can go wrong

### 1. `react-router` is not shared by a remote
Scenario: cart drops `react-router` from `shared`; the shell renders `cart/CartWidget` (a `<Link>`) in its header.
- **Symptom:** the whole shell is blank; console:
  `Uncaught TypeError: Cannot destructure property 'basename' of 'react__WEBPACK_IMPORTED_MODULE_10__.useContext(...)' as it is null.`
  A remote that calls a hook directly gets the invariant instead (text from the router source), e.g.
  `useNavigate() may be used only in the context of a <Router> component.` (`useLocation()`, `useHref()` likewise).
  In v8 `<Link>` reads the navigation context before calling `useHref`, so a `<Link>` hits the `TypeError` first.
- **Root cause:** cart bundles its own copy of `react-router`. Its `NavigationContext` is a different object from
  the one the shell's `<BrowserRouter>` provides, so `useContext` in cart's copy returns the default value `null`:
  the remote is "outside any router" although it is rendered inside one.
- **Fix:** `react-router` as a singleton in every app (chosen). Never provide routing contexts across MF boundaries
  through non-shared modules. An error boundary per remote (iteration 09) would limit the damage to one slot.

### 2. A remote renders its own `<BrowserRouter>` inside the host
- **Symptom (router shared):** blank page,
  `Uncaught Error: You cannot render a <Router> inside another <Router>. You should never have more than one in your app.`
- **Symptom (router not shared):** no error, but two histories on one page:
  - cart's own `<Routes>` matches the full URL, not the part after `/cart`: `index` does not match `/cart`, the cart
    page is empty and the console warns `No routes matched location "/cart"`;
  - with a catch-all route in cart: clicking cart's "Continue shopping" changes the URL to `/catalog`, but the shell
    still shows the cart page — the shell's router did not see the `pushState` made by cart's history. Back/forward
    (`popstate`) reach both routers, so the UI jumps back into sync only on history moves.
- **Root cause:** each `<BrowserRouter>` owns a history instance and listens only to its own `push`/`replace`.
  A nested router does not know its mount point either.
- **Fix:** the host owns the only router; a remote's router lives only in its standalone `bootstrap.tsx` (chosen).
  If a remote must keep internal navigation out of the URL (an embedded widget), give it a `MemoryRouter` — then it
  must not link to host URLs, and the host passes callbacks for cross-app navigation.

### 3. Refresh on a nested URL loads the HTML instead of the app
Scenario: shell with `output.publicPath: 'auto'`, refresh on `/catalog/p1`.
- **Symptom:** blank page; `GET http://localhost:3000/catalog/main.js → 404`,
  `Refused to execute script from 'http://localhost:3000/catalog/main.js' because its MIME type ('text/html') is not executable, and strict MIME type checking is enabled.`
- **Root cause:** `historyApiFallback` serves `index.html` for `/catalog/p1`, but with `publicPath: 'auto'` it contains
  `<script src="main.js">`, which the browser resolves relative to the current URL → `/catalog/main.js`. Requests with
  a dot in the path are not rewritten by the fallback, so it is a 404 HTML page.
- **Fix:** absolute script URLs in the HTML — `output.publicPath: '/'` for the shell (chosen), or
  `HtmlWebpackPlugin({ publicPath: '/' })` when chunks must stay on `'auto'` (remotes, chosen), or `<base href="/">`.

### 4. Relative links inside a remote mounted on a splat route
Scenario: account's `App` renders `<NavLink to="orders">` next to its `<Routes>`; the shell mounts it at `/account/*`.
- **Symptom:** on `/account/profile` the "Orders" link goes to `/account/profile/orders`; nothing matches, the page is
  empty. Moving the nav into a path-less layout route does not help.
- **Root cause:** relative links resolve against the nearest route **with a path**, and for a splat route against its
  full pathname including the splat. Path-less layout and `index` routes are skipped when resolving.
- **Fix:** links through `ROUTES` constants (chosen); or `../orders` (fragile, depends on depth); or put links inside
  routes that have their own path.

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| Host-owned `BrowserRouter` + shared singleton router (chosen) | one history, deep links and back/forward just work | all apps must agree on one router major version |
| `MemoryRouter` in each remote | remote isolated from the URL | no deep links into the remote; host must sync URL manually |
| Remote owns a top-level path, communicates via events | no shared router package | duplicated history logic, easy to desync |
| Route constants in `packages/contracts` (chosen) | no string literals, compile-time errors on rename | every app rebuilt to pick up a renamed route (iteration 04 contracts rules) |
| Remote-defined routes exported to the host (route objects via MF) | remote fully owns its URLs | host depends on remote at route-table build time; harder lazy loading |

## Interview questions
- **Q:** Who should own the URL in a micro-frontend app?
  **A:** The host. One router, one history; remotes declare relative routes under a prefix the host gives them.
- **Q:** Why must the router be a shared singleton?
  **A:** Routing state lives in React contexts created by the router module. A second copy has different context
  objects, so remotes are "outside a router" even when rendered inside one.
- **Q:** When would you use `MemoryRouter` for a remote?
  **A:** For an embedded widget whose internal navigation must not change the page URL; cross-app navigation then
  goes through callbacks or events from the host.
- **Q:** How do you avoid coupling through URLs?
  **A:** Route constants in a contracts package, relative route definitions inside remotes, and treating route changes
  as contract changes (iteration 04).
- **Q:** Deep links work in the remote standalone but not in the host. What do you check?
  **A:** `historyApiFallback`, absolute script URLs in `index.html` (`publicPath`), and that the host route has a
  trailing `/*` for the remote's prefix.

## Links
- React Router: [Picking a mode](https://reactrouter.com/start/modes), [Declarative routing](https://reactrouter.com/start/declarative/routing)
- React Router v7 changelog: [relative splat path](https://reactrouter.com/upgrading/v6#v7_relativesplatpath)
- webpack: [`output.publicPath`](https://webpack.js.org/configuration/output/#outputpublicpath),
  [devServer `historyApiFallback`](https://webpack.js.org/configuration/dev-server/#devserverhistoryapifallback)
- html-webpack-plugin: [options (`publicPath`)](https://github.com/jantimon/html-webpack-plugin#options)
