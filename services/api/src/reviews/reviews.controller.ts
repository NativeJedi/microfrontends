import { Controller, Get } from '@nestjs/common';
import { AuthMode } from '../auth/auth-mode';
import { ReviewsService, type Review } from './reviews.service';

// Public like the catalog it belongs to.
@AuthMode('optional')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll(): Review[] {
    return this.reviewsService.findAll();
  }
}
