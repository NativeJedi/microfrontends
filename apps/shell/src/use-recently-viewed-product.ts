import { MF_EVENTS, subscribeToMfEvent, type ProductViewedPayload } from '@mf/contracts';
import { useEffect, useState } from 'react';

// Events are fire-and-forget: only what is dispatched after this subscription is seen (no replay).
export function useRecentlyViewedProduct(): ProductViewedPayload | null {
  const [product, setProduct] = useState<ProductViewedPayload | null>(null);

  useEffect(() => subscribeToMfEvent(MF_EVENTS.productViewed, setProduct), []);

  return product;
}
