import type { ApiClient } from './http';

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

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[];
}

export function getOrders(api: ApiClient): Promise<Order[]> {
  return api.request<Order[]>('/orders');
}

export function createOrder(api: ApiClient, request: CreateOrderRequest): Promise<Order> {
  return api.request<Order>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}
