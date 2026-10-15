import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import type { CreateOrderRequest } from './create-order-request';

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

@Injectable()
export class OrdersService {
  private readonly orders: Order[] = [
    {
      id: 'o-1001',
      items: [{ productId: 'p3', name: 'Standing desk mat', price: 54, quantity: 1 }],
      total: 54,
      createdAt: '2026-10-01T10:00:00.000Z',
    },
    {
      id: 'o-1002',
      items: [{ productId: 'p1', name: 'Mechanical keyboard', price: 89, quantity: 1 }],
      total: 89,
      createdAt: '2026-10-08T15:30:00.000Z',
    },
  ];

  constructor(private readonly productsService: ProductsService) {}

  findAll(): Order[] {
    return this.orders;
  }

  // Names and prices come from the server's catalog, never from the client.
  create(request: CreateOrderRequest): Order {
    const items = request.items.map(({ productId, quantity }) => {
      const { name, price } = this.productsService.findById(productId);
      return { productId, name, price, quantity };
    });
    const order: Order = {
      id: `o-${1001 + this.orders.length}`,
      items,
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      createdAt: new Date().toISOString(),
    };
    this.orders.push(order);
    return order;
  }
}
