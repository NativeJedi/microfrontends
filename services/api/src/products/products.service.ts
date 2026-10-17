import { Injectable, NotFoundException } from '@nestjs/common';

export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

// In-memory data: the API exists to give the micro-frontends a real network boundary, not to persist anything.
const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Mechanical keyboard', price: 89, description: 'Tactile switches, USB-C.' },
  { id: 'p2', name: 'USB-C hub', price: 39, description: 'HDMI, 3× USB-A, SD card reader.' },
  { id: 'p3', name: 'Standing desk mat', price: 54, description: 'Anti-fatigue foam, 90×50 cm.' },
];

@Injectable()
export class ProductsService {
  findAll(): Product[] {
    return PRODUCTS;
  }

  findById(productId: string): Product {
    const product = PRODUCTS.find(({ id }) => id === productId);
    if (!product) throw new NotFoundException(`Product ${productId} not found`);
    return product;
  }
}
