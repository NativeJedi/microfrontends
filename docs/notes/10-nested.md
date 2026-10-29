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

## Links
- Module Federation (webpack 5): https://webpack.js.org/concepts/module-federation/
- `ModuleFederationPlugin` options: https://webpack.js.org/plugins/module-federation-plugin/
- React error boundaries: https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
- React `use`: https://react.dev/reference/react/use
