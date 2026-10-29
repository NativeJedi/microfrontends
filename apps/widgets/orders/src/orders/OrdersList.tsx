import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { useOrdersWidgetTranslation } from '../i18n/use-orders-widget-translation';
import styles from './Orders.module.css';
import { useOrdersInPeriod } from './use-orders-in-period';

const ORDER_DATE_FORMAT = { dateStyle: 'medium' } as const;

/** The widget application's index route: every order of the shell's period, not just the newest few. */
export default function OrdersList() {
  const t = useOrdersWidgetTranslation();
  const { orders, period, isPending, error } = useOrdersInPeriod();

  if (isPending) return <p>{t('loading')}</p>;
  if (error) return <p>{t('loadError', { message: error.message })}</p>;
  if (!orders?.length) return <p>{t('emptyInPeriod', { count: period })}</p>;

  return (
    <div className={styles.app}>
      <p className={styles.subtitle}>
        {t('inPeriod', { count: period })} · {t('orderCount', { count: orders.length })}
      </p>
      <ul className={styles.list}>
        {orders.map((order) => (
          <li key={order.id} className={styles.row}>
            <span>
              {/* Absolute, from the shell's route map: every link in this repo comes from @mf/contracts. */}
              <Link to={ROUTES.dashboard.order(order.id)}>{order.id}</Link>{' '}
              <span className={styles.meta}>
                {t('placedAt', {
                  value: new Date(order.createdAt),
                  formatParams: { value: ORDER_DATE_FORMAT },
                })}
              </span>
            </span>
            <span className={styles.total}>{t('total', { value: order.total })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
