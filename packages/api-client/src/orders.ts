import { requestJson } from './http';

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

export function getOrders(): Promise<Order[]> {
  return requestJson<Order[]>('/orders');
}

export function createOrder(request: CreateOrderRequest): Promise<Order> {
  return requestJson<Order>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
}
