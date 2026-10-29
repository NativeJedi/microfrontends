import type { WidgetMeta, WidgetProps } from '@mf/contracts';
import type { ComponentType } from 'react';

/** What every widget's `./Widget` expose must look like: the component plus its `meta`. */
export interface WidgetModule {
  default: ComponentType<WidgetProps>;
  meta: WidgetMeta;
}

/**
 * The widget URLs are **not** here — they are in webpack.config.js, as static `remotes`. This map only
 * binds a registry id to the import specifier webpack resolves against them. The consequence is the
 * honest limitation of this iteration: the API can list a fourth widget, but a build that has never
 * heard of it cannot import it, so it renders as "unknown widget" until this map and the webpack
 * `remotes` grow an entry. Iteration 09's `loadRemote` replaces the whole map with the registry's `url`
 * and `scope` (see docs/notes/10-nested.md).
 */
const loaders: Record<string, () => Promise<WidgetModule>> = {
  sales: () => import('widget_sales/Widget'),
  orders: () => import('widget_orders/Widget'),
  reviews: () => import('widget_reviews/Widget'),
};

/** Thrown for a registry id this build has no import for; the card turns it into its "unknown" state. */
export class UnknownWidgetError extends Error {
  constructor(readonly widgetId: string) {
    super(`No module bound to widget "${widgetId}" in this dashboard build`);
  }
}

/**
 * One promise per widget, kept so that `use()` gets the same promise on every render — otherwise each
 * render would start a new import and suspend forever. A rejected promise stays cached too (that is how
 * a failure keeps showing the fallback instead of retrying on every render), so "Retry" has to drop it:
 * see `forgetWidgetModule`.
 */
const modulePromises = new Map<string, Promise<WidgetModule>>();

export function loadWidgetModule(widgetId: string): Promise<WidgetModule> {
  const cached = modulePromises.get(widgetId);
  if (cached) return cached;

  const loader = loaders[widgetId];
  const promise = loader ? loader() : Promise.reject(new UnknownWidgetError(widgetId));
  modulePromises.set(widgetId, promise);
  return promise;
}

/** Drops the cached promise so the next render imports the widget again. */
export function forgetWidgetModule(widgetId: string): void {
  modulePromises.delete(widgetId);
}
