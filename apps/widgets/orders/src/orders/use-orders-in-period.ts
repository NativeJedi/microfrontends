import { API_CLIENT_SERVICE, type Order } from '@mf/api-client';
import { periodStartIso, type DashboardPeriod } from '@mf/contracts';
import { orderQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
// State that belongs to the shell, two federation levels above this widget.
import { useDashboardPeriod } from 'shell/store';

interface OrdersInPeriod {
  orders: Order[] | undefined;
  period: DashboardPeriod;
  isPending: boolean;
  error: Error | null;
}

/**
 * The orders of the period the shell is filtering by, newest first. Both faces of this widget use it:
 * the card on the dashboard grid and the full application below `/dashboard/orders`.
 *
 * The request itself is `orderQueries.list` — the same key the account app and the sales widget use — so
 * the filtering happens on one cached `/orders` response instead of a request per widget.
 */
export function useOrdersInPeriod(): OrdersInPeriod {
  const api = useService(API_CLIENT_SERVICE);
  const period = useDashboardPeriod();
  const { data, isPending, error } = useQuery(orderQueries.list(api));

  const orders = useMemo(() => {
    if (!data) return undefined;
    const since = periodStartIso(period);
    return data
      .filter((order) => order.createdAt >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data, period]);

  return { orders, period, isPending, error };
}
