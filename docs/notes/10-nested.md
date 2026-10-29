# 10 — Nested micro-frontends: dashboard + widgets

> Challenge: new (no number in the original list)

## Problem
Until now every remote was a leaf: the shell loaded it and it rendered. A seller dashboard is not a leaf — it is a
page assembled from widgets that different teams deploy on their own schedule, so it has to be a **host** while it is
still a **remote** of the shell. That raises questions a two-level setup never asks: is there one share scope or two,
who owns the layout when the page and its pieces belong to different teams, and what happens to the other widgets
when one of them is broken at 3 a.m. on a Friday.

## Solution
A fourth remote, `apps/dashboard` (port 3004), and three widget apps, `apps/widgets/{sales,orders,reviews}`
(3011–3013). The dashboard's `ModuleFederationPlugin` is the only one in the repo with `exposes` **and** `remotes`:

```js
new ModuleFederationPlugin({
  name: 'dashboard',
  filename: 'remoteEntry.js',
  exposes: { './App': './src/exposed/App.tsx' },      // remote of the shell
  remotes: {                                          // host of the widgets
    widget_sales: 'widget_sales@http://localhost:3011/remoteEntry.js',
    widget_orders: 'widget_orders@http://localhost:3012/remoteEntry.js',
    widget_reviews: 'widget_reviews@http://localhost:3013/remoteEntry.js',
  },
  shared: { react: { singleton: true, … }, /* the same singletons the shell declares */ },
})
```

The widget contract lives in `@mf/contracts` ([ADR 0014](../decisions/0014-widget-contract.md)): a default-exported
component taking `{ settings, size }` plus a named `meta` (`id`, `title`, `defaultSize`, `minSize`).

```tsx
export const meta: WidgetMeta = { id: 'sales', title: 'Sales', defaultSize: 'large', minSize: 'medium' };
export default function SalesWidget({ settings, size }: WidgetProps) { … }
```

The API gained a registry and a layout: `GET /widgets` (`id`, `scope`, `module`, `url`, `version`),
`GET`/`PUT /dashboard/layout` (order, size and settings per widget), plus `GET /reviews` for the third widget.
Widgets are loaded as **static remotes** — iteration 09's `loadRemote` was deferred, see
[ADR 0015](../decisions/0015-static-widget-remotes.md) and "What can go wrong", item 3.

Each card is its own unit: its own `<Suspense>`, its own error boundary, its own retry.

**Extension (same iteration, added at the user's request): a widget that is a whole application.**
`widget_orders` now exposes `./App` next to `./Widget` — the same deployment, a second entry point — and the shell
publishes the dashboard's global filter as `shell/store`:

```js
// apps/widgets/orders/webpack.config.js
exposes: { './Widget': './src/exposed/Widget.tsx', './App': './src/exposed/App.tsx' },
remotes: { shell: 'shell@http://localhost:3000/remoteEntry.js' },   // the leaf is a host of the root
```

```js
// apps/shell/webpack.config.js — the host is a remote now
filename: 'remoteEntry.js',
exposes: { './store': './src/exposed/store.ts' },
remotes: { shell: 'shell@http://localhost:3000/remoteEntry.js', catalog: …, dashboard: … },
```

That gives three routing levels (`/dashboard/*` → `:widgetId/*` → `index` | `:orderId`), a period filter that
travels from the shell's header into a widget two levels below, and a container graph with a cycle in it
([ADR 0016](../decisions/0016-shell-exposes-dashboard-state.md),
[ADR 0017](../decisions/0017-widget-as-application.md)).

## How it works

### One share scope across three levels
This is the part that looks like it needs special handling and does not. A container's `init(shareScope)` is what
decides which scope it uses, and the host always passes its own:

1. The shell's bundle creates the scope `default` (`__webpack_init_sharing__('default')`) and fills it with the
   modules it declared as `shared`.
2. The shell loads `dashboard/remoteEntry.js` and calls `dashboardContainer.init(__webpack_share_scopes__.default)`.
   Inside the dashboard's bundle, `__webpack_share_scopes__.default` **is that same object** — not a copy.
3. The dashboard imports `widget_sales/Widget`. Webpack injects the widget's `remoteEntry.js` and calls
   `salesContainer.init(__webpack_share_scopes__.default)` — the object it received in step 2.

So the widget's React request is answered from the scope the shell created. Nothing in the dashboard forwards
anything; it only has to **declare the same singletons**, so that its own `react` import is also a consumption from
the scope rather than a private copy.

`window.__mfDebug()` on `/dashboard` prints one row per package, no duplicates:

| package | version | providedBy | loaded |
|---|---|---|---|
| react | 19.3.0 | widget_sales | true |
| react-dom | 19.3.0 | widget_sales | true |
| @tanstack/react-query | 5.104.3 | widget_sales | true |
| @mf/services | 1.0.0 | widget_sales | true |

`providedBy` says `widget_sales`, which surprises everyone the first time. It is not "who loaded it": when several
containers offer the **same version** and none is loaded yet, webpack's `register` keeps the one whose `uniqueName`
sorts highest, and `widget_sales` > `shell`. One row means one instance; which bundle's copy of the file it is does
not matter, because they are the same version of the same package.

### Loading a widget and reading its `meta`
`React.lazy` only ever gives you the default export, and the card needs `meta` for its size and its heading. So the
dashboard resolves the module itself and caches the promise per widget id:

```ts
const modulePromises = new Map<string, Promise<WidgetModule>>();

export function loadWidgetModule(widgetId: string): Promise<WidgetModule> {
  const cached = modulePromises.get(widgetId);
  if (cached) return cached;
  const loader = loaders[widgetId];
  const promise = loader ? loader() : Promise.reject(new UnknownWidgetError(widgetId));
  modulePromises.set(widgetId, promise);
  return promise;
}
```

```tsx
const { default: Widget, meta } = use(loadWidgetModule(widgetId));
const size = clampWidgetSize(savedSize ?? meta.defaultSize, meta.minSize);
```

The cache is not an optimization, it is a correctness requirement: `use()` must get the **same** promise on every
render, otherwise each render starts a new import and the component suspends forever. The same cache is why "Retry"
has to call `forgetWidgetModule(id)` first — a rejected promise stays in the map and would reject again instantly.

### Who owns what
- **API** owns which widgets exist (the registry) and stores the layout without understanding it: its validation of
  `settings` stops at "a JSON object".
- **Dashboard** owns order, size and settings, and the chrome around each card (heading, size control, fallbacks).
- **Widget** owns everything inside its card, including its own i18n namespace (`widget_sales`, …) and the meaning
  of its settings. `settings` arrives as `Readonly<Record<string, unknown>>` and each widget narrows its own keys:

```ts
export function readDays(settings: WidgetSettings): number {
  const { days } = settings;
  return typeof days === 'number' && Number.isInteger(days) && days > 0 ? days : DEFAULT_DAYS;
}
```

- **Size is a negotiation, not an order.** The layout proposes, the widget's `minSize` vetoes: the sales widget
  cannot be made "small", and its option is rendered `disabled`.

### The shared cache pays for itself here
The sales widget and the orders widget both use `orderQueries.list(api)` — the same key the account app uses. On a
dashboard with both of them the network panel shows **one** `GET /orders`. That only works because
`@tanstack/react-query` is a singleton at all three levels: a second copy would mean a second `QueryClientProvider`
context and two caches.

### Three levels of descendant routes
Each `<Routes>` matches only what the level above left over, and none of them knows where it is mounted:

| Level | Route it declares | URL it matches | File |
|---|---|---|---|
| shell | `/dashboard/*` | `/dashboard/orders/o-1001` | `apps/shell/src/App.tsx` |
| dashboard | `:widgetId/*` | `orders/o-1001` | `apps/dashboard/src/exposed/App.tsx` |
| widget | `:orderId` | `o-1001` | `apps/widgets/orders/src/exposed/App.tsx` |

The dashboard mounts widget applications generically — `:widgetId/*`, not `orders/*` — and asks
`widget-modules.ts` whether that id has an `./App` binding. The same map decides whether the card shows an "Open"
link. Navigation stays the **host's** business: the dashboard knows it mounted the widget at
`/dashboard/orders`, the widget does not.

The card and the application are two exposes of one deployment, and the difference between them is not cosmetic:
a card is a component, an application is a router level. `./Widget` works in any host; `./App` demands that its
host own a `<BrowserRouter>` and share `react-router` as a singleton.

### State that comes from above
The period filter lives in a Zustand store in the shell, next to the `<select>` that changes it, and the shell
publishes it the way cart publishes the cart (ADR 0009) — as functions, not as the raw store:

```ts
// apps/shell/src/exposed/store.ts
export const useDashboardPeriod: DashboardPeriodStore['useDashboardPeriod'] = () =>
  useDashboardPeriodStore((state) => state.period);
```

```ts
// apps/widgets/orders/src/orders/use-orders-in-period.ts
import { useDashboardPeriod } from 'shell/store';
```

Nothing in the dashboard mentions the period. It is not a prop, it does not appear in `WidgetProps`, and the
dashboard does not redeploy when the shell adds another field to the store. Two kinds of state now reach one
widget from two directions:

| State | Owner | How it travels | Why |
|---|---|---|---|
| `size`, `settings` | dashboard (the layout) | props, per card | They are a property of *this placement* of the widget |
| period filter | shell | `shell/store`, read directly | It is a property of the *page*, identical for every widget |

### A host that is also a remote
A build with `exposes` has two entry points — `main.js` and `remoteEntry.js` — and **each carries its own webpack
runtime**. In the development build both files contain their own `var __webpack_modules__` and
`__webpack_module_cache__ = {}`. A module reached through both is therefore evaluated twice, which for a store
means two independent stores (see "What can go wrong", item 5).

So the shell consumes its own expose through its own container, listing itself in `remotes` and importing
`shell/store` like any other remote module. `tsconfig.json` maps that specifier to the source with `paths` (a
package cannot be its own workspace dependency); webpack ignores the mapping and resolves it through federation.
The build output shows the result: `main.js` holds the external `shell@http://localhost:3000/remoteEntry.js`, and
the store itself lives in one chunk, `src_exposed_store_ts.js`, behind the container.

## What can go wrong

### 1. The dashboard bundles its own React → "Invalid hook call", but only inside the widgets
- **Symptom:** the shell renders, the dashboard page renders, and the moment a widget mounts:
  `Warning: Invalid hook call. Hooks can only be called inside of the body of a function component.` followed by
  `TypeError: Cannot read properties of null (reading 'useState')`. The dashboard's own components are fine, which
  is what makes it confusing.
- **Root cause:** `react` missing from (or not `singleton` in) the dashboard's `shared`. The dashboard then imports
  its own copy. The widgets *do* share correctly and get the shell's copy, so the widget's component is rendered by
  the dashboard's React reconciler while its hooks come from the shell's React — two module instances, one
  `ReactCurrentDispatcher` each, and the one the widget reads is `null` during that render.
- **Fix:** declare the same singletons in the dashboard as in the shell (the chosen fix — an intermediate host must
  share everything it passes through). Verify with `window.__mfDebug()`: one row per package. In a monorepo,
  reading `requiredVersion` from the installed `react/package.json` keeps the ranges aligned; `strictVersion: false`
  keeps a minor mismatch a warning instead of a crash.

### 2. One widget throws → the whole dashboard goes blank
- **Symptom:** an uncaught error in one widget and the page shows nothing at all — not the other widgets, not the
  dashboard heading. In the console: `The above error occurred in the <ReviewsWidget> component.` and, with no
  boundary anywhere, React's "The root component unmounted" behaviour.
- **Root cause:** React unmounts the whole subtree below the nearest error boundary. Without one, "the nearest" is
  the root. The size of the subtree a boundary wraps is exactly the blast radius of a crash, and with federation the
  code in that subtree is deployed by someone else.
- **Fix:** one boundary **per card**, not one per page (the chosen fix). `WidgetErrorBoundary` renders a fallback
  with the widget's id and a "Retry" button; the other cards never re-render. Verified by making the reviews widget
  throw: sales and orders kept their data, reviews showed `This widget failed: …` with Retry.
  Per-card `<Suspense>` matters for the same reason: one shared `Suspense` would hold every widget back until the
  slowest `remoteEntry.js` had arrived. Note what boundaries do **not** catch: errors in event handlers, in
  `setTimeout`, and in promises the widget never awaits — those still reach `window.onerror`.

### 3. Widget URLs hardcoded → adding a widget needs a dashboard rebuild
- **Symptom:** a fourth entry is added to `GET /widgets` and nothing new appears on the dashboard. With the card
  this iteration ships, the symptom is explicit: a card titled `inventory` saying
  `This dashboard build does not know this widget yet.`, while the console shows
  `UnknownWidgetError: No module bound to widget "inventory" in this dashboard build`.
  With a naive implementation the symptom is worse — a raw
  `Error: Cannot find module 'widget_inventory/Widget'` or, after a deploy that moved a remote,
  `ChunkLoadError: Loading chunk … failed`.
- **Root cause:** `remotes` in `webpack.config.js` is build-time input. Webpack turns `import('widget_sales/Widget')`
  into a reference to a container it was told about at compile time; a container nobody mentioned does not exist for
  that bundle, however complete the registry is.
- **Fix:** load remotes at runtime from the registry — inject `remoteEntry.js`, `__webpack_init_sharing__('default')`,
  `container.init(__webpack_share_scopes__.default)`, `container.get(module)`. That is iteration 09's `loadRemote`,
  which is deferred ([ADR 0015](../decisions/0015-static-widget-remotes.md)), so **this criterion is not met in
  iteration 10** and the dashboard says so on screen instead of pretending otherwise. Everything around the loading
  is already registry-driven: revisiting 09 replaces `widget-modules.ts` and the `remotes` block, nothing else.
  Two other shapes of the same fix exist: Module Federation 2.0's runtime API (iteration 17), and an import map /
  SystemJS layer outside webpack.

### 4. A per-widget timeout that cannot be honoured
- **Symptom:** a widget's dev server is stopped; the card shows "Loading widget…" until the browser's own TCP
  timeout — minutes, not seconds. Adding `Promise.race([import(...), rejectAfter(8s)])` seems to fix it, and then
  "Retry" never recovers: it fails instantly with `ChunkLoadError` even after the server is back.
- **Root cause:** with a static remote, webpack owns the `<script>` tag and its promise. It caches the rejection of a
  failed `remoteEntry.js` load for the lifetime of the page, and a `Promise.race` wrapper cannot un-cache it. The
  timeout would be real; the recovery would be theatre.
- **Fix:** own the script tag — the same `loadRemote` as above, where the timeout and the cache reset are the same
  piece of code. Not faking it is deliberate: see the working rules in CLAUDE.md about never weakening a criterion
  silently.

### 5. The shell exposes a store and imports it relatively → two stores, and no error anywhere
- **Symptom:** the period `<select>` in the header switches, the label updates, and nothing else on the page
  reacts. No console error, no warning, `window.__mfDebug()` perfectly clean — one `react`, one `react-dom`, one
  of everything. Reloading the page shows the *persisted* value in both places, which makes it look like a
  re-render problem rather than an identity problem.
- **Root cause:** `exposes` adds a second entry point to the build. `main.js` and `remoteEntry.js` each define
  their own `__webpack_modules__` and `__webpack_module_cache__`, so `src/dashboard-period/store.ts` reached
  relatively from the header and through `shell/store` from the widget is **two module instances** —
  `create()` runs twice, and each copy has its own subscribers. The share scope does not help: a shared module is
  negotiated between *containers*, and this is one build talking to itself.
- **Fix:** the shell reads its own state through its own container (the chosen fix) — `shell` in its own `remotes`
  and `import … from 'shell/store'` in the header. Two alternatives with the same effect: register the store
  instance in the `@mf/services` container, which the shell already provides to everyone (option 2 of ADR 0016), or
  declare the store module itself as a shared module so both runtimes consume it from the share scope.
  A giveaway while debugging: add a module-level `console.log` to the store file and count the lines.

### 6. The dashboard is mounted without a splat → "Page not found" one click later
- **Symptom:** `/dashboard` renders the grid, clicking "Open" changes the URL to `/dashboard/orders` and the shell
  renders its own `t('notFound')` page. The dashboard is not even mounted any more, so its own `<Routes>` never get
  the chance to say anything.
- **Root cause:** `<Route path="/dashboard">` matches that one pathname and nothing below it. A parent that hosts
  descendant `<Routes>` must end in `/*`, as `ROUTES.catalog.root` has since iteration 03. The nesting of routers
  has to mirror the nesting of federation: every level that hosts another level needs its own splat.
- **Fix:** `path={`${ROUTES.dashboard.root}/*`}` in the shell and `path=":widgetId/*"` in the dashboard. The same
  trap in reverse: the widget's `<Route path=":orderId">` needs **no** splat, because nothing routes below it.

### 7. The widget's `./App` renders `<Routes>` without sharing `react-router`
- **Symptom:** the orders card still works, and the moment `/dashboard/orders` mounts the application, the router
  invariant from iteration 03 appears — `useNavigate() may be used only in the context of a <Router> component.`
  (or, for a `<Link>`, the `TypeError` on the destructured `basename`). If the widget instead brings its own
  `<BrowserRouter>`, nothing throws and the bug is worse: two histories on one page, a back button that undoes the
  wrong navigation, and links that update the URL without re-rendering the shell.
- **Root cause:** the router's location lives in a React context created at module level. A second copy of
  `react-router` is a second context, which the shell's `<BrowserRouter>` never fills.
- **Fix:** `react-router` as a singleton in `shared` of every level that renders routes — the shell had it, the
  dashboard and `widget_orders` got it in this extension. The card, which renders no routes, is unaffected either
  way; this is why the leaf stayed router-free until it became an application.

### 8. The container graph has a cycle, so the type graph cannot copy it
- **Symptom:** adding `"shell": "workspace:*"` to `widget_orders` (to get the types of `shell/store` the way every
  other host gets a remote's types, ADR 0008) makes Turborepo refuse to run: the `types` task of `shell` waits for
  `widget_orders`, which waits for `dashboard`, which waits for `shell`.
- **Root cause:** `shell → dashboard → widget_orders → shell` is fine at runtime — containers only hold URLs, and
  the loop is resolved by whoever loads first — but `typecheck` depends on `^types`, and a build graph cannot have
  a cycle.
- **Fix:** the *interface* of the expose moved into `@mf/contracts`, a leaf both sides already depend on
  (`DashboardPeriodStore`). The shell annotates its exports with it; `widget_orders` has a six-line
  `src/shell-store.d.ts` declaring `shell/store` from the same interface. Hand-written, but checked on both ends:
  a change to the contract breaks whichever side is wrong. The alternative — a dedicated `@mf/shell-contract`
  package — buys nothing here, since `@mf/contracts` is already that package.

### 9. The leaf now depends on the root
- **Symptom:** the standalone widget page on :3012 fetches `http://localhost:3000/remoteEntry.js`, the store chunk
  and `zustand` from the **shell's** origin (visible in the network panel of :3012). With :3000 down, that load is
  the one that fails, and a page that is supposed to be independent of the shell cannot render.
- **Root cause:** reading `shell/store` makes the widget a host of the shell. Independence is a property of the
  *graph*, not of the port a thing runs on, and this iteration deliberately added an edge back to the root.
- **Fix:** none applied — it is the accepted cost of ADR 0016, written down in the ADR's consequences. If a widget
  had to survive without the shell, the state would travel as a prop from the dashboard (option 3) or through the
  service container with a default (option 2), both of which keep the graph acyclic. The same reasoning applies to
  `output.publicPath`: the shell had to move from `'/'` to `'auto'`, because its chunks are now fetched by pages on
  other origins.

## Trade-offs and alternatives

| Option | Pros | Cons |
|---|---|---|
| **Static `remotes` in the dashboard** (chosen) | No new runtime code; the iteration's own topic stays in focus | A new widget needs a dashboard rebuild; no per-widget timeout |
| Runtime `loadRemote` (iteration 09) | Registry is the only source of URLs; timeout and retry are real | ~380 lines of hand-written container protocol, deferred by the user |
| Module Federation 2.0 runtime API | Dynamic remotes, plugins and type generation maintained upstream | Leaves classic MF, which the whole project is built to teach (iteration 17) |
| **One boundary per card** (chosen) | A crash costs one widget | A boundary and a fallback per card; more chrome to translate |
| One boundary around the grid | Less code | One broken widget blanks the dashboard |
| **`use()` on a cached module promise** (chosen) | Component and `meta` arrive together; retry is a cache delete | Hand-written cache; a rejected promise must be dropped explicitly |
| `React.lazy` per widget | Idiomatic, retry via `key` | Cannot reach `meta`; needs a second import or a second expose |
| **`settings` as `unknown`, narrowed by the widget** (chosen) | A new widget ships without touching shared packages | No compile-time check across the boundary |
| A settings union in `@mf/contracts` | Type-safe end to end | Every new widget changes a package every app depends on |
| **Widget state from `shell/store`** (chosen) | The dashboard forwards nothing; adding shell state is additive | The container graph gains a cycle; the widget needs :3000 even standalone |
| The store instance in the `@mf/services` container | No new container edge; standalone keeps working | A service key is a weaker contract than an expose |
| The period as a prop through the dashboard | Explicit, type-checked end to end | `WidgetProps` grows per field; the dashboard redeploys for state it does not use |
| **A second expose `./App`** (chosen) | One deployment, one team, two entry points | The widget now demands a router from its host |
| A `mode` prop on `./Widget` | No new expose | A switch statement across a deployment boundary; routing code in every card |
| A separate `orders_app` remote | The card stays router-free | Two deployments and two namespaces for one domain |

## Interview questions

- **Q:** A remote is also a host. Does it need its own share scope for its children?
  **A:** No. The scope is created once, by the top-level host, and travels through `init`. The shell calls
  `dashboardContainer.init(scope)`; inside the dashboard's bundle `__webpack_share_scopes__.default` is that same
  object, and the widgets are initialized with it. The intermediate host's only job is to declare the same
  singletons, so its own imports are consumptions from the scope rather than a private copy.

- **Q:** Hooks break inside the widgets but the dashboard itself renders fine. What is wrong?
  **A:** The intermediate host is not sharing React. Its components run on its private copy, the widgets resolve
  React from the shared scope, and a component rendered by one reconciler while reading hooks from another gets a
  `null` dispatcher — "Invalid hook call". `__mfDebug()` shows it as two rows for `react`.

- **Q:** Where do you put error boundaries in a nested federation, and why there?
  **A:** One per independently deployed unit, so the blast radius matches the deployment unit. On the dashboard that
  means one per card: the code in a card is shipped by another team, and a bad deploy of theirs must cost their card
  and nothing else. The same argument applies to `Suspense`: a shared one couples every widget's first paint to the
  slowest remote.

- **Q:** Who owns a widget's size — the dashboard or the widget?
  **A:** Both, and the split matters. The dashboard owns the layout, because sizes are a property of the page, not
  of any one widget. The widget owns `minSize`, because only it knows below which width it is unreadable. The host
  clamps the stored size against it, and renders the forbidden options as disabled.

- **Q:** Why does `settings` cross the boundary as `unknown`?
  **A:** Because the alternative couples deployments. A typed union of every widget's settings would live in a
  package the dashboard, the API and every widget depend on, so shipping a new widget would mean redeploying all of
  them. `unknown` plus a few lines of narrowing in the widget that owns the keys keeps the type safety where the
  knowledge is.

- **Q:** The registry lists a widget and nothing appears. Why?
  **A:** Because `remotes` is build-time input. Webpack resolves `import('widget_x/Widget')` against the containers
  it was told about at compile time, so a registry entry alone cannot produce one. Fixing it means loading the
  container at runtime: inject the script, `__webpack_init_sharing__`, `container.init`, `container.get`.

- **Q:** The shell owns a piece of state that a widget two levels down needs. How does it get there?
  **A:** Not by forwarding. The shell exposes it (`shell/store`) and the widget imports it, which makes the shell a
  remote of its own remotes. The dashboard in the middle never mentions it, so the shell can add state without
  redeploying the level between. The price is a cycle in the container graph and a widget that needs the shell's
  origin even when it runs alone — the alternatives are a service-container key or a prop through the dashboard.

- **Q:** You exposed a store from the host and the host's own UI stopped seeing changes. Why?
  **A:** A build with `exposes` has two entry points, `main.js` and `remoteEntry.js`, and each has its own webpack
  runtime and module cache. Importing the store relatively in the host's own code evaluates it a second time, so
  there are two stores and no error anywhere. The host has to consume its own expose through its own container.

- **Q:** How deep can routing nest in a federation, and who owns the splat?
  **A:** As deep as the federation itself. Every level that hosts another level declares `/*` and renders
  descendant `<Routes>`; every level matches only the remainder of the URL and never learns its mount point. The
  router is still single — `react-router` is a singleton — so there is one history for all of them.

- **Q:** Why did the widget need `react-router` now, when iteration 10 deliberately left it out?
  **A:** Because it stopped being a card. A component can be mounted anywhere; a router level cannot — it requires
  a `<Router>` above it and the same `react-router` instance as the host. That is exactly why the two faces are two
  exposes: `./Widget` keeps the weak requirement, `./App` carries the strong one.

## Links
- Module Federation (webpack 5): https://webpack.js.org/concepts/module-federation/
- `ModuleFederationPlugin` options: https://webpack.js.org/plugins/module-federation-plugin/
- React error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- React `use`: https://react.dev/reference/react/use
