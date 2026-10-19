import { type ApiClient, getProduct, getProducts } from '@mf/api-client';
import { queryOptions } from '@tanstack/react-query';
import { STALE_TIME_MS } from './stale-time';

export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (productId: string) => [...productKeys.all, 'detail', productId] as const,
};

export const productQueries = {
  list: (api: ApiClient) =>
    queryOptions({
      queryKey: productKeys.list(),
      queryFn: () => getProducts(api),
      staleTime: STALE_TIME_MS,
    }),
  detail: (api: ApiClient, productId: string) =>
    queryOptions({
      queryKey: productKeys.detail(productId),
      queryFn: () => getProduct(api, productId),
      staleTime: STALE_TIME_MS,
    }),
};
