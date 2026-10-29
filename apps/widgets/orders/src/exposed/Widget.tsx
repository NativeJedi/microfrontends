import { API_CLIENT_SERVICE, type Order } from '@mf/api-client';
import type { WidgetMeta, WidgetProps, WidgetSize } from '@mf/contracts';
import { orderQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useQuery } from '@tanstack/react-query';
import { useOrdersWidgetTranslation } from '../i18n/use-orders-widget-translation';
import { readLimit } from '../settings';
import styles from './Widget.module.css';

// The named half of the widget contract: the dashboard reads it to size the card and to label it when
// it has no translation of its own for this widget's id.
export const meta: WidgetMeta = {
  id: 'orders',
  title: 'Recent orders',
  defaultSize: 'medium',
  minSize: 'small',
};

// Intl.DateTimeFormat options for the "datetime" formatter in the message.
const ORDER_DATE_FORMAT = { dateStyle: 'medium' } as const;

function OrderRow({ order, size }: { order: Order; size: WidgetSize }) {
  const t = useOrdersWidgetTranslation();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <li className={styles.row}>
      <span>
        {order.id}
        {/* The narrowest card keeps the id and the amount; the date and item count are the detail. */}
        {size !== 'small' && (
          <>
            {' '}
            <span className={styles.meta}>
              {t('placedAt', {
                value: new Date(order.createdAt),
                formatParams: { value: ORDER_DATE_FORMAT },
              })}{' '}
              · {t('itemCount', { count: itemCount })}
            </span>
          </>
        )}
      </span>
      <span className={styles.total}>{t('total', { value: order.total })}</span>
    </li>
  );
}

/**
 * The newest orders. It reuses `orderQueries.list` — the same key the account app and the sales widget
 * use — so the whole page shares one cached `/orders` response.
 */
export default function OrdersWidget({ settings, size }: WidgetProps) {
  const t = useOrdersWidgetTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const limit = readLimit(settings);
  const { data: orders, isPending, error } = useQuery(orderQueries.list(api));

  if (isPending) return <p>{t('loading')}</p>;
  if (error) return <p>{t('loadError', { message: error.message })}</p>;

  const newest = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);

  return (
    <div className={styles.card}>
      <p className={styles.subtitle}>{t('subtitle', { count: newest.length })}</p>
      {newest.length === 0 && <p>{t('empty')}</p>}
      <ul className={styles.list}>
        {newest.map((order) => (
          <OrderRow key={order.id} order={order} size={size} />
        ))}
      </ul>
    </div>
  );
}
