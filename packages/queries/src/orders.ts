import { type ApiClient, getOrder, getOrders } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const orderKeys = {
  all: ['orders'] as const,
  list: () => [...orderKeys.all, 'list'] as const,
  detail: (orderId: string) => [...orderKeys.all, 'detail', orderId] as const,
};

export const orderQueries = {
  list: (api: ApiClient) =>
    queryOptions({
      queryKey: orderKeys.list(),
      queryFn: () => getOrders(api),
      staleTime: STALE_TIME_MS,
    }),
  /** One order, for a deep link that arrives before the list has ever been fetched. */
  detail: (api: ApiClient, orderId: string) =>
    queryOptions({
      queryKey: orderKeys.detail(orderId),
      queryFn: () => getOrder(api, orderId),
      staleTime: STALE_TIME_MS,
    }),
};
