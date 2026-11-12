import { ROUTES } from '@mf/contracts';
import { Suspense, use } from 'react';
import { Link, useParams } from 'react-router';
import { useDashboardTranslation } from '../i18n/use-dashboard-translation';
import styles from './WidgetAppRoute.module.css';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import { forgetWidgetModule, hasWidgetApp, loadWidgetApp } from './widget-modules';

/** Suspends on the widget's `./App` module, exactly as the card suspends on its `./Widget`. */
function LoadedWidgetApp({ widgetId }: { widgetId: string }) {
  const { default: WidgetApp } = use(loadWidgetApp(widgetId));
  return <WidgetApp />;
}

/**
 * `/dashboard/<widgetId>/*`: the whole page belongs to one widget. The dashboard keeps only the frame
 * around it — the way back — and the widget routes on its own below this point.
 *
 * The isolation is the same as on a card: a widget's application that fails to load or throws replaces
 * this route, never the dashboard's own chrome and never the grid behind it.
 */
export default function WidgetAppRoute() {
  const t = useDashboardTranslation();
  const { widgetId = '' } = useParams();

  return (
    <section className={styles.page}>
      <Link to={ROUTES.dashboard.root}>{t('app.back')}</Link>
      {hasWidgetApp(widgetId) ? (
        <WidgetErrorBoundary
          onRetry={() => forgetWidgetModule(widgetId)}
          fallback={(error, retry) => (
            <div className={styles.failure}>
              <p>{t('widget.failed', { message: error.message })}</p>
              <button type="button" onClick={retry}>
                {t('widget.retry')}
              </button>
            </div>
          )}
        >
          <Suspense fallback={<p>{t('widget.loading')}</p>}>
            <LoadedWidgetApp widgetId={widgetId} />
          </Suspense>
        </WidgetErrorBoundary>
      ) : (
        <p>{t('app.unknown', { widgetId })}</p>
      )}
    </section>
  );
}
