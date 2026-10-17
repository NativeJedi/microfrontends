import { getProduct, getProducts } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (productId: string) => [...productKeys.all, 'detail', productId] as const,
};

export const productQueries = {
  list: () =>
    queryOptions({
      queryKey: productKeys.list(),
      queryFn: getProducts,
      staleTime: STALE_TIME_MS,
    }),
  detail: (productId: string) =>
    queryOptions({
      queryKey: productKeys.detail(productId),
      queryFn: () => getProduct(productId),
      staleTime: STALE_TIME_MS,
    }),
};
