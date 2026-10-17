import { getOrders } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const orderKeys = {
  all: ['orders'] as const,
  list: () => [...orderKeys.all, 'list'] as const,
};

export const orderQueries = {
  list: () =>
    queryOptions({
      queryKey: orderKeys.list(),
      queryFn: getOrders,
      staleTime: STALE_TIME_MS,
    }),
};
