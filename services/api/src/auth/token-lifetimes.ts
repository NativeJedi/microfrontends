// Short on purpose: the refresh path runs within a minute of a demo (query staleTime is 60s).
// Real apps use minutes, not seconds.
export const ACCESS_TOKEN_TTL_SECONDS = 30;

export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Dev only: becomes a secret from runtime environment config in iteration 13.
export const DEV_JWT_SECRET = 'dev-only-jwt-secret';
