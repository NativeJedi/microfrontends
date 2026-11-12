// The global dashboard filter: owned by the shell, read by the widgets. Only the *shape* lives here —
// the state itself is a store inside the shell, published through its `./store` expose (ADR 0016).
//
// The type of that expose is declared here, in a leaf package both sides already depend on, because the
// container graph is circular: shell → dashboard → widget_orders → shell. Generated declarations follow
// the dependency graph and cannot follow a cycle, so the contract is written by hand and both ends check
// themselves against it (see `apps/widgets/orders/src/shell-store.d.ts`).

/** Periods the shell offers, in days. */
export const DASHBOARD_PERIODS = [7, 30, 90] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = 30;

/** Untrusted input (localStorage, an older build, another app's call) narrowed to a known period. */
export function parseDashboardPeriod(value: unknown): DashboardPeriod | undefined {
  return DASHBOARD_PERIODS.find((period) => period === value);
}

/** Everything the shell publishes as `shell/store`. Both the shell and its consumers are typed by it. */
export interface DashboardPeriodStore {
  /** Subscribes the calling component: it re-renders when the shell's selection changes. */
  useDashboardPeriod: () => DashboardPeriod;
  /** Reads the current value without subscribing (event handlers, query functions). */
  getDashboardPeriod: () => DashboardPeriod;
  setDashboardPeriod: (period: DashboardPeriod) => void;
}

/** Oldest `createdAt` that still belongs to the period, as an ISO string. */
export function periodStartIso(period: DashboardPeriod, now: number = Date.now()): string {
  return new Date(now - period * 24 * 60 * 60 * 1000).toISOString();
}
