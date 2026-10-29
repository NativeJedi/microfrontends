import { type ApiClient, getDashboardLayout, getWidgetRegistry } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const widgetKeys = {
  all: ['widgets'] as const,
  registry: () => [...widgetKeys.all, 'registry'] as const,
  layout: () => [...widgetKeys.all, 'layout'] as const,
};

export const widgetQueries = {
  /** Which widgets are deployed. Shared cache: a widget could read it too, e.g. to link to a sibling. */
  registry: (api: ApiClient) =>
    queryOptions({
      queryKey: widgetKeys.registry(),
      queryFn: () => getWidgetRegistry(api),
      staleTime: STALE_TIME_MS,
    }),
  /** The user's widget order, sizes and settings. Written back by the dashboard's save mutation. */
  layout: (api: ApiClient) =>
    queryOptions({
      queryKey: widgetKeys.layout(),
      queryFn: () => getDashboardLayout(api),
      staleTime: STALE_TIME_MS,
    }),
};
