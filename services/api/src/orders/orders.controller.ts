import { Body, Controller, Get, Post } from '@nestjs/common';
import { parseCreateOrderRequest } from './create-order-request';
import { OrdersService, type Order } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(): Order[] {
    return this.ordersService.findAll();
  }

  @Post()
  create(@Body() body: unknown): Order {
    return this.ordersService.create(parseCreateOrderRequest(body));
  }
}
