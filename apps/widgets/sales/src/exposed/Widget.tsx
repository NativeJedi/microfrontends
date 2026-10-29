import { API_CLIENT_SERVICE } from '@mf/api-client';
import type { WidgetMeta, WidgetProps } from '@mf/contracts';
import { orderQueries } from '@mf/queries';
import { useService } from '@mf/services';
import { useQuery } from '@tanstack/react-query';
import { useSalesWidgetTranslation } from '../i18n/use-sales-widget-translation';
import { summarizeRevenue, type RevenueBucket } from '../revenue';
import { readDays } from '../settings';
import styles from './Widget.module.css';

// The named half of the widget contract: the dashboard reads it to size the card and to label it when
// it has no translation of its own for this widget's id.
export const meta: WidgetMeta = {
  id: 'sales',
  title: 'Sales',
  defaultSize: 'large',
  minSize: 'medium',
};

function BucketRow({ bucket, max }: { bucket: RevenueBucket; max: number }) {
  const t = useSalesWidgetTranslation();
  const label = { from: bucket.from, to: bucket.to };

  return (
    <>
      <span className={styles.bucketLabel}>{t('bucketLabel', label)}</span>
      <progress
        className={styles.bar}
        value={bucket.total}
        max={max}
        aria-label={t('bucketBar', label)}
      />
      <span className={styles.bucketTotal}>{t('revenue', { value: bucket.total })}</span>
    </>
  );
}

/**
 * Revenue over the configured period. It reuses `orderQueries.list` — the same key the account app and
 * the orders widget use — so the whole page shares one cached `/orders` response.
 */
export default function SalesWidget({ settings, size }: WidgetProps) {
  const t = useSalesWidgetTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const days = readDays(settings);
  const { data: orders, isPending, error } = useQuery(orderQueries.list(api));

  if (isPending) return <p>{t('loading')}</p>;
  if (error) return <p>{t('loadError', { message: error.message })}</p>;

  const { total, orderCount, buckets } = summarizeRevenue(orders, days);
  const maxBucketTotal = Math.max(...buckets.map((bucket) => bucket.total), 1);

  return (
    <div className={styles.card}>
      <p className={styles.total}>{t('revenue', { value: total })}</p>
      <p>
        {t('period', { count: days })} · {t('orderCount', { count: orderCount })}
      </p>
      {orderCount === 0 && <p>{t('empty')}</p>}
      {/* The card is narrower at "medium": the breakdown is the first thing to drop. */}
      {size === 'large' && orderCount > 0 && (
        <div className={styles.buckets}>
          {buckets.map((bucket) => (
            <BucketRow key={bucket.from} bucket={bucket} max={maxBucketTotal} />
          ))}
        </div>
      )}
    </div>
  );
}
