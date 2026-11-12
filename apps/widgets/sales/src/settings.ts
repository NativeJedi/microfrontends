import type { WidgetSettings } from '@mf/contracts';

export const DEFAULT_DAYS = 30;

/**
 * The dashboard stores widget settings without understanding them, so they arrive as `unknown`
 * (SPEC section 6: narrow at MF boundaries). Only this widget knows that `days` is a positive number,
 * and an unusable value falls back to the default instead of breaking the card.
 */
export function readDays(settings: WidgetSettings): number {
  const { days } = settings;
  return typeof days === 'number' && Number.isInteger(days) && days > 0 ? days : DEFAULT_DAYS;
}
