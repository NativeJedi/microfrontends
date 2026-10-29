import { useDashboardLayout } from '../layout/use-dashboard-layout';
import { useDashboardTranslation } from '../i18n/use-dashboard-translation';
import WidgetCard from '../widgets/WidgetCard';
import styles from './App.module.css';

/**
 * A remote of the shell and a host of three widgets at the same time. It renders no router: the shell
 * mounts it on the single route /dashboard, and the dashboard's own job starts below that URL.
 */
export default function App() {
  const t = useDashboardTranslation();
  const { widgets, isPending, error, setSize } = useDashboardLayout();

  return (
    <section>
      <h2>{t('title')}</h2>
      <p className={styles.subtitle}>{t('subtitle')}</p>
      {isPending && <p>{t('loading')}</p>}
      {error && <p>{t('loadError', { message: error.message })}</p>}
      {widgets?.length === 0 && <p>{t('empty')}</p>}
      <div className={styles.grid}>
        {widgets?.map((widget) => (
          <WidgetCard
            key={widget.id}
            widgetId={widget.id}
            savedSize={widget.size}
            settings={widget.settings}
            onResize={setSize}
          />
        ))}
      </div>
    </section>
  );
}
