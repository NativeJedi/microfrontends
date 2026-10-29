import type { Order } from '@mf/api-client';

export interface RevenueBucket {
  /** Days ago the bucket starts at (inclusive), counting back from today. */
  from: number;
  /** Days ago the bucket ends at (exclusive). */
  to: number;
  total: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET_COUNT = 5;

export interface RevenueSummary {
  total: number;
  orderCount: number;
  buckets: RevenueBucket[];
}

/**
 * The widget derives its numbers from the orders the whole page already has in the TanStack Query
 * cache: no `/sales` endpoint, no second request when the orders widget is on the same dashboard.
 */
export function summarizeRevenue(orders: Order[], days: number): RevenueSummary {
  const now = Date.now();
  const bucketDays = Math.max(1, Math.ceil(days / BUCKET_COUNT));
  const buckets: RevenueBucket[] = [];

  for (let from = 0; from < days; from += bucketDays) {
    buckets.push({ from, to: Math.min(from + bucketDays, days), total: 0 });
  }

  let total = 0;
  let orderCount = 0;

  for (const order of orders) {
    const daysAgo = (now - new Date(order.createdAt).getTime()) / DAY_MS;
    if (daysAgo < 0 || daysAgo >= days) continue;

    total += order.total;
    orderCount += 1;

    const bucket = buckets[Math.min(Math.floor(daysAgo / bucketDays), buckets.length - 1)];
    if (bucket) bucket.total += order.total;
  }

  return { total, orderCount, buckets };
}
