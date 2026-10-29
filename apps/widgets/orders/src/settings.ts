import type { WidgetSettings } from '@mf/contracts';

export const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

/**
 * The dashboard stores widget settings without understanding them, so they arrive as `unknown`
 * (SPEC section 6: narrow at MF boundaries). An unusable value falls back to the default instead of
 * breaking the card.
 */
export function readLimit(settings: WidgetSettings): number {
  const { limit } = settings;
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}
