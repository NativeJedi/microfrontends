import type { ApiClient } from './http';

/** One deployed widget, as the registry describes it. Mirrors `WidgetRegistryEntry` in the API. */
export interface WidgetRegistryEntry {
  id: string;
  /** Module Federation container name, e.g. `widget_sales`. */
  scope: string;
  /** Exposed module inside that container, e.g. `./Widget`. */
  module: string;
  /** URL of the container's remoteEntry.js. */
  url: string;
  version: string;
}

export interface DashboardLayoutEntry {
  id: string;
  /** Missing until the user resizes the widget: the widget's own `defaultSize` applies. */
  size?: string;
  settings?: Readonly<Record<string, unknown>>;
}

export interface DashboardLayout {
  widgets: DashboardLayoutEntry[];
}

export function getWidgetRegistry(api: ApiClient): Promise<WidgetRegistryEntry[]> {
  return api.request<WidgetRegistryEntry[]>('/widgets');
}

export function getDashboardLayout(api: ApiClient): Promise<DashboardLayout> {
  return api.request<DashboardLayout>('/dashboard/layout');
}

export function saveDashboardLayout(
  api: ApiClient,
  layout: DashboardLayout,
): Promise<DashboardLayout> {
  return api.request<DashboardLayout>('/dashboard/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
}
