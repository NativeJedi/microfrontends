import { clampWidgetSize, WIDGET_SIZES, type WidgetSettings, type WidgetSize } from '@mf/contracts';
import { Suspense, use } from 'react';
import { useDashboardTranslation } from '../i18n/use-dashboard-translation';
import styles from './WidgetCard.module.css';
import WidgetErrorBoundary from './WidgetErrorBoundary';
import { forgetWidgetModule, loadWidgetModule, UnknownWidgetError } from './widget-modules';

interface WidgetCardProps {
  widgetId: string;
  /** From the saved layout; absent until the user has resized this widget. */
  savedSize?: WidgetSize;
  settings: WidgetSettings;
  onResize: (widgetId: string, size: WidgetSize) => void;
}

/** The size the card is drawn at before its widget's `meta` is known (loading and failure states). */
const PLACEHOLDER_SIZE: WidgetSize = 'medium';

function CardShell({
  size,
  title,
  children,
  control,
}: {
  size: WidgetSize;
  title: string;
  children: React.ReactNode;
  control?: React.ReactNode;
}) {
  return (
    <article className={styles.card} data-size={size}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {control}
      </div>
      {children}
    </article>
  );
}

function SizeControl({
  widgetId,
  size,
  minSize,
  onResize,
}: {
  widgetId: string;
  size: WidgetSize;
  minSize: WidgetSize;
  onResize: (widgetId: string, size: WidgetSize) => void;
}) {
  const t = useDashboardTranslation();

  return (
    <label className={styles.sizeLabel}>
      {t('size.label')}
      <select
        value={size}
        onChange={(event) => onResize(widgetId, event.target.value as WidgetSize)}
      >
        {WIDGET_SIZES.map((option) => (
          // The widget's own minSize wins over the layout: the dashboard may not make it unusable.
          <option
            key={option}
            value={option}
            disabled={WIDGET_SIZES.indexOf(option) < WIDGET_SIZES.indexOf(minSize)}
          >
            {t(`size.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Suspends on the widget's module: `use()` throws the cached promise, so everything below the card's
 * <Suspense> waits, and a rejection reaches the card's own error boundary. The component and its `meta`
 * arrive together, so the card can size and label itself from the widget's own declaration.
 */
function LoadedWidget({ widgetId, savedSize, settings, onResize }: WidgetCardProps) {
  const t = useDashboardTranslation();
  const { default: Widget, meta } = use(loadWidgetModule(widgetId));
  const size = clampWidgetSize(savedSize ?? meta.defaultSize, meta.minSize);
  // The dashboard's chrome is the dashboard's text, so the host translates it. A widget it has no
  // translation for — one added to the registry after this build — falls back to the widget's own name.
  const title = t(`widgets.${widgetId}.title`, { defaultValue: meta.title });

  return (
    <CardShell
      size={size}
      title={title}
      control={
        <SizeControl widgetId={widgetId} size={size} minSize={meta.minSize} onResize={onResize} />
      }
    >
      <Widget settings={settings} size={size} />
    </CardShell>
  );
}

/**
 * One widget in the grid, with its own <Suspense> and its own error boundary. Both are per card on
 * purpose: a shared boundary would replace every widget when one of them failed, and a shared Suspense
 * would hold all of them back until the slowest module had arrived.
 */
export default function WidgetCard(props: WidgetCardProps) {
  const t = useDashboardTranslation();
  const { widgetId, savedSize } = props;

  return (
    <WidgetErrorBoundary
      // A cached rejected promise would keep failing on every render, so the retry drops it first.
      onRetry={() => forgetWidgetModule(widgetId)}
      fallback={(error, retry) => (
        <CardShell size={savedSize ?? PLACEHOLDER_SIZE} title={widgetId}>
          <div className={styles.failure}>
            <p className={styles.failureMessage}>
              {error instanceof UnknownWidgetError
                ? t('widget.unknown')
                : t('widget.failed', { message: error.message })}
            </p>
            {!(error instanceof UnknownWidgetError) && (
              <button type="button" onClick={retry}>
                {t('widget.retry')}
              </button>
            )}
          </div>
        </CardShell>
      )}
    >
      <Suspense
        fallback={
          <CardShell size={savedSize ?? PLACEHOLDER_SIZE} title={widgetId}>
            <p>{t('widget.loading')}</p>
          </CardShell>
        }
      >
        <LoadedWidget {...props} />
      </Suspense>
    </WidgetErrorBoundary>
  );
}
