import type { WidgetMeta, WidgetProps } from '@mf/contracts';
import type { ComponentType } from 'react';

/** What every widget's `./Widget` expose must look like: the component plus its `meta`. */
export interface WidgetModule {
  default: ComponentType<WidgetProps>;
  meta: WidgetMeta;
}

/**
 * The optional second expose of a widget that is a whole application: `./App`, a component with its own
 * relative `<Routes>`. Unlike `./Widget` it takes no props — it reads the URL and the shell's state
 * itself — and it does require a router in whatever host mounts it.
 */
export interface WidgetAppModule {
  default: ComponentType;
}

interface WidgetBinding {
  loadWidget: () => Promise<WidgetModule>;
  /** Only widgets that are applications have one; the card shows an "Open" link for those. */
  loadApp?: () => Promise<WidgetAppModule>;
}

/**
 * The widget URLs are **not** here — they are in webpack.config.js, as static `remotes`. This map only
 * binds a registry id to the import specifiers webpack resolves against them. The consequence is the
 * honest limitation of this iteration: the API can list a fourth widget, but a build that has never
 * heard of it cannot import it, so it renders as "unknown widget" until this map and the webpack
 * `remotes` grow an entry. Iteration 09's `loadRemote` replaces the whole map with the registry's `url`
 * and `scope` (see docs/notes/10-nested.md).
 */
const bindings: Record<string, WidgetBinding> = {
  sales: { loadWidget: () => import('widget_sales/Widget') },
  orders: {
    loadWidget: () => import('widget_orders/Widget'),
    loadApp: () => import('widget_orders/App'),
  },
  reviews: { loadWidget: () => import('widget_reviews/Widget') },
};

/** Thrown for a registry id this build has no import for; the card turns it into its "unknown" state. */
export class UnknownWidgetError extends Error {
  constructor(readonly widgetId: string) {
    super(`No module bound to widget "${widgetId}" in this dashboard build`);
  }
}

/** Whether this widget is a whole application, i.e. whether `/dashboard/<id>` has anything to show. */
export function hasWidgetApp(widgetId: string): boolean {
  return Boolean(bindings[widgetId]?.loadApp);
}

/**
 * One promise per module, kept so that `use()` gets the same promise on every render — otherwise each
 * render would start a new import and suspend forever. A rejected promise stays cached too (that is how
 * a failure keeps showing the fallback instead of retrying on every render), so "Retry" has to drop it:
 * see `forgetWidgetModule`.
 */
const modulePromises = new Map<string, Promise<unknown>>();

function cached<T>(cacheKey: string, load: (() => Promise<T>) | undefined, widgetId: string) {
  const hit = modulePromises.get(cacheKey);
  if (hit) return hit as Promise<T>;

  const promise = load ? load() : Promise.reject(new UnknownWidgetError(widgetId));
  modulePromises.set(cacheKey, promise);
  return promise as Promise<T>;
}

export function loadWidgetModule(widgetId: string): Promise<WidgetModule> {
  return cached(`${widgetId}#Widget`, bindings[widgetId]?.loadWidget, widgetId);
}

export function loadWidgetApp(widgetId: string): Promise<WidgetAppModule> {
  return cached(`${widgetId}#App`, bindings[widgetId]?.loadApp, widgetId);
}

/** Drops the cached promises so the next render imports the widget again. */
export function forgetWidgetModule(widgetId: string): void {
  modulePromises.delete(`${widgetId}#Widget`);
  modulePromises.delete(`${widgetId}#App`);
}
