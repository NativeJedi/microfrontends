import { Controller, Get, Param } from '@nestjs/common';
import { AuthMode } from '../auth/auth-mode';
import { ProductsService, type Product } from './products.service';

// Public catalog. A logged-in user's expired token is still rejected (bad credentials → 401),
// so the client refreshes here exactly as on protected routes.
@AuthMode('optional')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Product[] {
    return this.productsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') productId: string): Product {
    return this.productsService.findById(productId);
  }
}
