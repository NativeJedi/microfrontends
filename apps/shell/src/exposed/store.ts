import type { DashboardPeriodStore } from '@mf/contracts';
import { useDashboardPeriodStore } from '../dashboard-period/store';

// Public API of the shell's dashboard state for the apps below it. The store and its shape stay private,
// so the shell can change them without a contract change; `DashboardPeriodStore` from @mf/contracts is
// what both ends are checked against (the container graph is circular, so no generated types cross it).

export const useDashboardPeriod: DashboardPeriodStore['useDashboardPeriod'] = () =>
  useDashboardPeriodStore((state) => state.period);

export const getDashboardPeriod: DashboardPeriodStore['getDashboardPeriod'] = () =>
  useDashboardPeriodStore.getState().period;

export const setDashboardPeriod: DashboardPeriodStore['setDashboardPeriod'] = (period) =>
  useDashboardPeriodStore.getState().setPeriod(period);
