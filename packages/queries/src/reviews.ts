import { type ApiClient, getReviews } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const reviewKeys = {
  all: ['reviews'] as const,
  list: () => [...reviewKeys.all, 'list'] as const,
};

export const reviewQueries = {
  list: (api: ApiClient) =>
    queryOptions({
      queryKey: reviewKeys.list(),
      queryFn: () => getReviews(api),
      staleTime: STALE_TIME_MS,
    }),
};
