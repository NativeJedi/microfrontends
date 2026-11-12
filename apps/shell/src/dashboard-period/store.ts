import {
  DEFAULT_DASHBOARD_PERIOD,
  parseDashboardPeriod,
  type DashboardPeriod,
} from '@mf/contracts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DashboardPeriodState {
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
}

/**
 * The shell owns the dashboard's global filter, the way cart owns the cart (ADR 0009): the state lives in
 * the app whose UI changes it, and everybody else reads it through an expose — here `shell/store`.
 *
 * One instance per page only if this module is evaluated once. The shell's own bundle and its
 * `remoteEntry.js` are two webpack runtimes with two module caches, so the shell's own components must
 * reach it through the container too (ADR 0016).
 */
export const useDashboardPeriodStore = create<DashboardPeriodState>()(
  persist(
    (set) => ({
      period: DEFAULT_DASHBOARD_PERIOD,
      setPeriod: (period) => set({ period }),
    }),
    {
      name: 'dashboard:period',
      version: 1,
      partialize: (state) => ({ period: state.period }),
      // localStorage is untrusted input (edited by hand, written by an older build): unknown values
      // fall back to the default instead of reaching the widgets.
      merge: (persisted, current) => ({
        ...current,
        period:
          parseDashboardPeriod((persisted as { period?: unknown } | undefined)?.period) ??
          current.period,
      }),
    },
  ),
);
