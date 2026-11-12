# 0017 — A widget that is an application exposes a second module, `./App`

- Status: accepted
- Date: 2026-10-29
- Iteration: 10

## Context
A card on a dashboard grid is not where a widget's team stops. The orders widget shows five rows; the team also owns
the full orders view — a list of everything in the period and a details page per order. The question is what shape
that takes in a nested federation: the dashboard is already a remote of the shell and a host of the widgets, and the
widget is already a leaf with no router (iteration 10, ADR 0014).

## Options
1. **A second expose `./App` with its own relative `<Routes>`** — the card and the application are two entry points
   into one deployment. The dashboard mounts the app under the widget's id (`/dashboard/orders/*`) and the widget
   routes below that. − The widget now needs `react-router` as a shared singleton, so it is no longer mountable in a
   host that has no router.
2. **One expose with a `mode` prop** (`'card' | 'page'`) — no new expose, no new `exports` entry. − A prop that
   changes the component into a different application is not a contract, it is a switch statement across a
   deployment boundary; and the card variant would still drag the routing code into every dashboard page.
3. **A separate remote for the full view** (`orders_app@…`) — the card stays a leaf with no router. − Two
   deployments, two share scope entries and two i18n namespaces for one team and one domain, with no boundary
   between them that anyone would want to defend.

## Decision
Option 1. `widget_orders` exposes both:

```js
exposes: {
  './Widget': './src/exposed/Widget.tsx',   // card: component, no router
  './App':    './src/exposed/App.tsx',      // application: descendant <Routes>
}
```

The routing is three levels of *descendant* routes, each one matching only what the level above left over:

| Level | Route | Matched by |
|---|---|---|
| shell | `/dashboard/*` | `apps/shell/src/App.tsx` |
| dashboard | `:widgetId/*` | `apps/dashboard/src/exposed/App.tsx` |
| widget | `index`, `:orderId` | `apps/widgets/orders/src/exposed/App.tsx` |

The dashboard mounts `:widgetId/*` generically and looks the binding up in `widget-modules.ts`: a widget that has an
`./App` gets an "Open" link on its card and a page under `/dashboard/<id>`, one that has not renders a message. The
link is the **dashboard's** chrome, not the widget's — the host knows where it mounted the widget, the widget does
not.

`react-router` is added to `shared` in the dashboard and in `widget_orders`, with the same options as everywhere
else (singleton, `^` + installed version, `strictVersion: false`).

## Consequences
- The widget contract now has two tiers, and the difference is a deployment fact, not a detail: **a card is a
  component, an application is a router level.** A host that mounts `./Widget` needs nothing; a host that mounts
  `./App` must own a `<BrowserRouter>` and must pass it down as a singleton.
- `widget_orders` standalone (:3012) needs its own router, like every other app with routes, and mounts its
  application at the same URL the dashboard uses, so a deep link is the same string in both places.
- The widget's links come from `ROUTES` in `@mf/contracts` (`ROUTES.dashboard.order(id)`), following the rule from
  iteration 03. That means the widget knows it lives under `/dashboard` — the price of the project's "no URL
  literals" convention. A widget that had to be mountable at an arbitrary prefix would need relative links
  (`<Link to={order.id}>`) and would lose the grep-ability the convention buys.
- `ROUTES.dashboard` changed from a string to an object (`root`, `widget(id)`, `order(id)`), and the shell's route
  became `'/dashboard/*'`. Any host that mounted the dashboard without a splat would stop matching as soon as the
  URL went deeper.
- The grid and the application share their data hook (`useOrdersInPeriod`) and therefore one cached `GET /orders`.
  The details page uses `orderQueries.detail`, so a deep link works on a cold cache.
