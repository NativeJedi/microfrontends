import { API_CLIENT_SERVICE } from '@mf/api-client';
import { ROUTES } from '@mf/contracts';
import { orderQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useOrdersWidgetTranslation } from '../i18n/use-orders-widget-translation';
import styles from './Orders.module.css';

const ORDER_DATE_FORMAT = { dateStyle: 'medium', timeStyle: 'short' } as const;

/**
 * The third routing level: shell `/dashboard/*` → dashboard `:widgetId/*` → this widget's `:orderId`.
 * It fetches the order by id instead of filtering the list, so a deep link works on a cold cache.
 */
export default function OrderDetails() {
  const t = useOrdersWidgetTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const { orderId = '' } = useParams();
  const { data: order, isPending, error } = useQuery(orderQueries.detail(api, orderId));

  if (isPending) return <p>{t('loading')}</p>;
  if (error) return <p>{t('loadError', { message: error.message })}</p>;

  return (
    <div className={styles.app}>
      <Link to={ROUTES.dashboard.widget('orders')}>{t('backToList')}</Link>
      <h3>{t('orderTitle', { id: order.id })}</h3>
      <p className={styles.subtitle}>
        {t('placedAt', {
          value: new Date(order.createdAt),
          formatParams: { value: ORDER_DATE_FORMAT },
        })}
      </p>
      <table className={styles.items}>
        <thead>
          <tr>
            <th className={styles.cell}>{t('item')}</th>
            <th className={styles.number}>{t('quantity')}</th>
            <th className={styles.number}>{t('price')}</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.productId}>
              <td className={styles.cell}>{item.name}</td>
              <td className={styles.number}>{item.quantity}</td>
              <td className={styles.number}>{t('total', { value: item.price })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.total}>{t('orderTotal', { value: order.total })}</p>
    </div>
  );
}
