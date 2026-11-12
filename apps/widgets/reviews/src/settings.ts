import type { WidgetSettings } from '@mf/contracts';

export const DEFAULT_MIN_RATING = 1;
const MAX_RATING = 5;

/**
 * The dashboard stores widget settings without understanding them, so they arrive as `unknown`
 * (SPEC section 6: narrow at MF boundaries). An unusable value falls back to the default instead of
 * breaking the card.
 */
export function readMinRating(settings: WidgetSettings): number {
  const { minRating } = settings;
  if (typeof minRating !== 'number' || !Number.isInteger(minRating) || minRating < 1) {
    return DEFAULT_MIN_RATING;
  }
  return Math.min(minRating, MAX_RATING);
}
