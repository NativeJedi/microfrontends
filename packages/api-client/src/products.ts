import { requestJson } from './http';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export function getProducts(): Promise<Product[]> {
  return requestJson<Product[]>('/products');
}

export function getProduct(productId: string): Promise<Product> {
  return requestJson<Product>(`/products/${encodeURIComponent(productId)}`);
}
