import { Injectable, NotFoundException } from '@nestjs/common';
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

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

// Seeded relative to "now": the sales widget sums revenue over the last N days, so fixed dates would
// make the dashboard look empty a few weeks after they were written.
const SEED: Order[] = [
  {
    id: 'o-1001',
    items: [{ productId: 'p3', name: 'Standing desk mat', price: 54, quantity: 1 }],
    total: 54,
    createdAt: daysAgo(1),
  },
  {
    id: 'o-1002',
    items: [{ productId: 'p1', name: 'Mechanical keyboard', price: 89, quantity: 1 }],
    total: 89,
    createdAt: daysAgo(3),
  },
  {
    id: 'o-1003',
    items: [
      { productId: 'p2', name: 'USB-C hub', price: 39, quantity: 2 },
      { productId: 'p3', name: 'Standing desk mat', price: 54, quantity: 1 },
    ],
    total: 132,
    createdAt: daysAgo(6),
  },
  {
    id: 'o-1004',
    items: [{ productId: 'p1', name: 'Mechanical keyboard', price: 89, quantity: 2 }],
    total: 178,
    createdAt: daysAgo(12),
  },
  {
    id: 'o-1005',
    items: [{ productId: 'p2', name: 'USB-C hub', price: 39, quantity: 1 }],
    total: 39,
    createdAt: daysAgo(25),
  },
  {
    id: 'o-1006',
    items: [{ productId: 'p3', name: 'Standing desk mat', price: 54, quantity: 3 }],
    total: 162,
    createdAt: daysAgo(45),
  },
];

@Injectable()
export class OrdersService {
  private readonly orders: Order[] = [...SEED];

  constructor(private readonly productsService: ProductsService) {}

  findAll(): Order[] {
    return this.orders;
  }

  // A deep link to /dashboard/orders/:id must work without the list having been fetched first.
  findById(orderId: string): Order {
    const order = this.orders.find((candidate) => candidate.id === orderId);
    if (!order) throw new NotFoundException(`Order "${orderId}" not found`);
    return order;
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
