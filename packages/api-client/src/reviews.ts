import type { ApiClient } from './http';

export interface Review {
  id: string;
  productId: string;
  /** Resolved by the API, so a widget can render a review without a second request. */
  productName: string;
  rating: number;
  author: string;
  comment: string;
  createdAt: string;
}

export function getReviews(api: ApiClient): Promise<Review[]> {
  return api.request<Review[]>('/reviews');
}
