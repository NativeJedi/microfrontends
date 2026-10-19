import type { ApiClient } from './http';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export function getProducts(api: ApiClient): Promise<Product[]> {
  return api.request<Product[]>('/products');
}

export function getProduct(api: ApiClient, productId: string): Promise<Product> {
  return api.request<Product>(`/products/${encodeURIComponent(productId)}`);
}
