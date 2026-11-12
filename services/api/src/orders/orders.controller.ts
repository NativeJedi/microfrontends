import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { parseCreateOrderRequest } from './create-order-request';
import { OrdersService, type Order } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(): Order[] {
    return this.ordersService.findAll();
  }

  // Declared after the collection route: ':orderId' would also match an empty path segment otherwise.
  @Get(':orderId')
  findOne(@Param('orderId') orderId: string): Order {
    return this.ordersService.findById(orderId);
  }

  @Post()
  create(@Body() body: unknown): Order {
    return this.ordersService.create(parseCreateOrderRequest(body));
  }
}
