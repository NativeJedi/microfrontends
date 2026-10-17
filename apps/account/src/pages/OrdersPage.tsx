import type { Order } from '@mf/api-client';
import { ROUTES } from '@mf/contracts';
import { orderQueries } from '@mf/queries';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { useAccountTranslation } from '../i18n/use-account-translation';

// Intl.DateTimeFormat options for the "datetime" formatter in the message.
const ORDER_DATE_FORMAT = { dateStyle: 'medium', timeStyle: 'short' } as const;

function OrderRow({ order }: { order: Order }) {
  const t = useAccountTranslation();

  return (
    <li>
      {order.id} ·{' '}
      {t('orders.placedAt', {
        value: new Date(order.createdAt),
        formatParams: { value: ORDER_DATE_FORMAT },
      })}
      :{' '}
      {order.items.map((item, index) => (
        <span key={item.productId}>
          {index > 0 && ', '}
          <Link to={ROUTES.catalog.product(item.productId)}>{item.name}</Link> × {item.quantity}
        </span>
      ))}{' '}
      {t('orders.total', { value: order.total })}
    </li>
  );
}

// Cart invalidates the orders key after checkout, so a new order shows up here without a reload.
export default function OrdersPage() {
  const t = useAccountTranslation();
  const { data: orders, isPending, error } = useQuery(orderQueries.list());

  return (
    <section>
      <h3>{t('orders.title')}</h3>
      {isPending && <p>{t('orders.loading')}</p>}
      {error && <p>{t('orders.loadError', { message: error.message })}</p>}
      <ul>
        {orders?.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ul>
    </section>
  );
}
