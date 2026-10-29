import { DASHBOARD_PERIODS, parseDashboardPeriod } from '@mf/contracts';
import { useShellTranslation } from '../i18n/use-shell-translation';
// The shell reads its own state through its own container, not through a relative import: see ADR 0016.
import { setDashboardPeriod, useDashboardPeriod } from 'shell/store';
import styles from './PeriodSelector.module.css';

/** The shell's control over state that the dashboard's widgets read. */
export default function PeriodSelector() {
  const t = useShellTranslation();
  const period = useDashboardPeriod();

  return (
    <label className={styles.label}>
      {t('period.label')}
      <select
        value={period}
        onChange={(event) => {
          const next = parseDashboardPeriod(Number(event.target.value));
          if (next) setDashboardPeriod(next);
        }}
      >
        {DASHBOARD_PERIODS.map((option) => (
          <option key={option} value={option}>
            {t('period.days', { count: option })}
          </option>
        ))}
      </select>
    </label>
  );
}
