# 0014 — Widget contract: a default-exported component plus a named `meta`, settings crossing as `unknown`

- Status: accepted
- Date: 2026-10-29
- Iteration: 10

## Context
Iteration 10 adds a dashboard that is a remote of the shell and a host of three widgets. The widgets are deployed
independently, so the dashboard cannot import their types of settings, cannot know their names in advance, and must
draw their chrome (card, heading, size control) before — or without ever — loading their code. Something has to
define what a widget *is*, and that definition is a cross-app contract in the sense of ADR 0008: additive changes
only, a breaking change means a new expose name.

Four questions had to be answered together: what a widget module looks like, who decides a widget's size, who
translates a widget's title, and how per-widget settings cross the boundary.

## Options
Shape of the module:
1. **Default-exported component + named `meta`** — one expose, one import, both arrive together; `React.lazy` can
   not reach `meta`, so the host resolves the module itself (`use()` on a cached promise). − The host must handle the
   promise instead of letting `lazy` do it.
2. **Two exposes (`./Widget`, `./meta`)** — the host can read the metadata without loading the component. − Two
   network round trips per widget and two entries to keep in sync in `exposes` and `exports` (ADR 0008).
3. **Metadata only in the API registry** — available before any code loads. − The widget's own declaration
   (`minSize`) then lives in a database row the widget team does not deploy, so code and metadata drift apart.

Who decides the size:
1. **Layout proposes, widget vetoes** — the dashboard stores a size per widget, the widget declares `defaultSize`
   and `minSize`, and the host clamps. − Needs `meta` before the final size is known.
2. **Host decides alone** — simplest; the widget is handed a width. − A three-column widget squeezed into one column
   is unreadable, and only the widget knows that.

Who translates the title:
1. **Host translates, widget's `meta.title` is the fallback** — the chrome is the host's text (SPEC section 6), and a
   widget the host has no translation for still gets a readable name.
2. **Widget renders its own title** — always localized by its owner. − The card has no heading until the widget
   loads, and a widget that fails to load has no name at all.

Settings:
1. **`Readonly<Record<string, unknown>>`, narrowed by the owning widget** — the dashboard and the API stay ignorant
   of every widget's shape. − Every widget needs a few lines of narrowing.
2. **A union of all widget settings types in `@mf/contracts`** — type safety on both sides. − Adding a widget would
   change a package every app depends on: a new widget could not ship without redeploying the dashboard.

## Decision
`@mf/contracts` gains `WidgetMeta`, `WidgetProps`, `WidgetSettings`, `WidgetSize`, `WIDGET_SIZES` and
`clampWidgetSize`. Every widget exposes `./Widget` as a default-exported component taking `WidgetProps`
(`settings`, `size`) plus a named export `meta: WidgetMeta` (`id`, `title`, `defaultSize`, `minSize`) — option 1
everywhere above:

- The host resolves the module itself and reads component and `meta` from one import.
- The layout proposes a size, the widget's `minSize` vetoes it: `clampWidgetSize(savedSize ?? defaultSize, minSize)`.
- The dashboard translates the card heading in its own namespace, keyed by widget id, and falls back to `meta.title`.
- Settings cross as `unknown` values and are narrowed inside the widget that owns them (`readDays`, `readLimit`,
  `readMinRating`), with a default for anything unusable.

The API stores layouts (`GET`/`PUT /dashboard/layout`) without understanding settings: its validation stops at "a
JSON object". Ownership: the API owns which widgets exist, the dashboard owns their order, size and settings, the
widget owns everything inside its card.

## Consequences
- A new widget ships without touching `@mf/contracts`, the API schema or any other widget. The dashboard needs a
  translation for its title only to improve on `meta.title`.
- `React.lazy` is not used for widgets: `use()` on a module promise cached by widget id is what lets the card read
  `meta` and the component together. The cache must be dropped on retry, since a rejected promise stays cached
  (see notes 10).
- A widget cannot be typed end to end from the dashboard: its settings are `unknown` on the way in. The compiler
  does not catch a layout that stores `{ days: "30" }` — the widget's own narrowing does, by falling back.
- `WidgetMeta.id` duplicates the registry id. They must match; nothing enforces it at build time, and contract
  testing (iteration 12) is where that check belongs.
- Widgets declare no router and render no links, so they work in any host. A widget that later needs a link must
  take it as a prop or add `react-router` to its `shared` — an additive contract change either way.
