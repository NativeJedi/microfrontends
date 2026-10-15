import { queryOptions } from '@tanstack/react-query';

// Static for dev; becomes runtime environment config in iteration 13.
export const API_BASE_URL = 'http://localhost:4000';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
}

// Query keys are a cross-app contract: every app reads and invalidates the one shared cache through them,
// so renaming a key is a breaking change (SPEC section 6).
export const productKeys = {
  all: ['products'] as const,
  list: () => [...productKeys.all, 'list'] as const,
  detail: (productId: string) => [...productKeys.all, 'detail', productId] as const,
};

export const orderKeys = {
  all: ['orders'] as const,
  list: () => [...orderKeys.all, 'list'] as const,
};

// Set per query, not on the QueryClient: a hosted remote runs with the shell's client defaults,
// a standalone one with its own, and caching must behave the same in both.
const STALE_TIME_MS = 60_000;

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  // Our own API: response bodies are trusted like typed imports (no runtime schema yet).
  return (await response.json()) as T;
}

// Key, fetcher and response type travel together, so two apps cannot store different shapes under one key.
export const productQueries = {
  list: () =>
    queryOptions({
      queryKey: productKeys.list(),
      queryFn: () => fetchJson<Product[]>('/products'),
      staleTime: STALE_TIME_MS,
    }),
  detail: (productId: string) =>
    queryOptions({
      queryKey: productKeys.detail(productId),
      queryFn: () => fetchJson<Product>(`/products/${encodeURIComponent(productId)}`),
      staleTime: STALE_TIME_MS,
    }),
};

export const orderQueries = {
  list: () =>
    queryOptions({
      queryKey: orderKeys.list(),
      queryFn: () => fetchJson<Order[]>('/orders'),
      staleTime: STALE_TIME_MS,
    }),
};
