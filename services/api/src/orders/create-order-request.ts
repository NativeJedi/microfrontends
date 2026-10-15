import { BadRequestException } from '@nestjs/common';

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOrderLine(value: unknown): value is CreateOrderRequest['items'][number] {
  return (
    isRecord(value) &&
    typeof value.productId === 'string' &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) > 0
  );
}

// The request body is untrusted input: narrow it before it reaches the service.
export function parseCreateOrderRequest(body: unknown): CreateOrderRequest {
  if (!isRecord(body) || !Array.isArray(body.items) || body.items.length === 0) {
    throw new BadRequestException('items must be a non-empty array');
  }
  if (!body.items.every(isOrderLine)) {
    throw new BadRequestException('each item needs a productId and a positive integer quantity');
  }
  return { items: body.items };
}
