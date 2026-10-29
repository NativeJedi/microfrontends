// The type of the shell's `./store` expose. It is written by hand instead of coming from the shell's
// generated declarations because the container graph is circular — shell → dashboard → widget_orders →
// shell — and a workspace dependency on `shell` would make the type build cyclic too (ADR 0016).
//
// Both ends are kept honest by the same interface in @mf/contracts: the shell annotates its exports with
// it, this declaration re-uses its members, so a change to the contract breaks whichever side is wrong.
declare module 'shell/store' {
  import type { DashboardPeriodStore } from '@mf/contracts';

  export const useDashboardPeriod: DashboardPeriodStore['useDashboardPeriod'];
  export const getDashboardPeriod: DashboardPeriodStore['getDashboardPeriod'];
  export const setDashboardPeriod: DashboardPeriodStore['setDashboardPeriod'];
}
