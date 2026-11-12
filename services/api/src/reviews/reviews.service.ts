import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

export interface Review {
  id: string;
  productId: string;
  productName: string;
  rating: number;
  author: string;
  comment: string;
  createdAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString();

// Seeded relative to "now" so the dashboard widgets always have recent data to show.
const SEED: Omit<Review, 'productName'>[] = [
  {
    id: 'r-1',
    productId: 'p1',
    rating: 5,
    author: 'Olena',
    comment: 'Switches feel great, worth the price.',
    createdAt: daysAgo(1),
  },
  {
    id: 'r-2',
    productId: 'p2',
    rating: 3,
    author: 'Marko',
    comment: 'HDMI works, the SD reader is slow.',
    createdAt: daysAgo(2),
  },
  {
    id: 'r-3',
    productId: 'p3',
    rating: 4,
    author: 'Iryna',
    comment: 'Thick enough for a whole workday.',
    createdAt: daysAgo(4),
  },
  {
    id: 'r-4',
    productId: 'p1',
    rating: 2,
    author: 'Dmytro',
    comment: 'Arrived with a dead LED.',
    createdAt: daysAgo(9),
  },
  {
    id: 'r-5',
    productId: 'p2',
    rating: 5,
    author: 'Sofia',
    comment: 'Replaced three dongles with one.',
    createdAt: daysAgo(15),
  },
];

@Injectable()
export class ReviewsService {
  constructor(private readonly productsService: ProductsService) {}

  // The product name is resolved on the server, so a widget can render a review without a second request.
  findAll(): Review[] {
    return SEED.map((review) => ({
      ...review,
      productName: this.productsService.findById(review.productId).name,
    }));
  }
}
