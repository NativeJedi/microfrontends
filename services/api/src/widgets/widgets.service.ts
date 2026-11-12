import { Injectable } from '@nestjs/common';
import type { DashboardLayout } from './dashboard-layout-request';

/**
 * One entry per deployed widget. `scope` is the Module Federation container name, `module` the exposed
 * path inside it and `url` its remoteEntry.js — everything a host needs to load the widget at runtime.
 *
 * The dashboard of iteration 10 still declares the widget URLs in its own webpack config (static
 * remotes), so these fields are informational there. They become the only source of widget URLs once
 * the dashboard loads them itself (iteration 09's `loadRemote`, see docs/notes/10-nested.md).
 */
export interface WidgetRegistryEntry {
  id: string;
  scope: string;
  module: string;
  url: string;
  version: string;
}

/** Order and per-widget configuration of one user's dashboard. */
export interface DashboardLayoutEntry {
  id: string;
  /** Omitted when the user has never resized the widget: the widget's own `defaultSize` applies. */
  size?: string;
  settings?: Record<string, unknown>;
}

const REGISTRY: WidgetRegistryEntry[] = [
  {
    id: 'sales',
    scope: 'widget_sales',
    module: './Widget',
    url: 'http://localhost:3011/remoteEntry.js',
    version: '1.0.0',
  },
  {
    id: 'orders',
    scope: 'widget_orders',
    module: './Widget',
    url: 'http://localhost:3012/remoteEntry.js',
    version: '1.0.0',
  },
  {
    id: 'reviews',
    scope: 'widget_reviews',
    module: './Widget',
    url: 'http://localhost:3013/remoteEntry.js',
    version: '1.0.0',
  },
];

// In-memory, one layout for the single demo user: the API exists to give the micro-frontends a real
// network boundary, not to persist anything.
const INITIAL_LAYOUT: DashboardLayout = {
  widgets: [
    { id: 'sales', size: 'large', settings: { days: 30 } },
    { id: 'orders', size: 'medium', settings: { limit: 3 } },
    { id: 'reviews', size: 'medium', settings: { minRating: 4 } },
  ],
};

@Injectable()
export class WidgetsService {
  private layout: DashboardLayout = INITIAL_LAYOUT;

  findAll(): WidgetRegistryEntry[] {
    return REGISTRY;
  }

  getLayout(): DashboardLayout {
    return this.layout;
  }

  saveLayout(layout: DashboardLayout): DashboardLayout {
    this.layout = layout;
    return this.layout;
  }
}
