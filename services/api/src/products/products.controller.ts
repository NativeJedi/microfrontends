import { Controller, Get, Param } from '@nestjs/common';
import { ProductsService, type Product } from './products.service';

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
