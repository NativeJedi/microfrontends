// Set per query, not on the QueryClient: a hosted remote runs with the shell's client defaults,
// a standalone one with its own, and caching must behave the same in both.
export const STALE_TIME_MS = 60_000;
