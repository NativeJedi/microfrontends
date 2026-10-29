import type { CookieOptions, Request, Response } from 'express';
import type { AuthTokens } from './auth.service';
import { REFRESH_TOKEN_TTL_MS } from './token-lifetimes';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// httpOnly: page scripts (including injected ones) cannot read either token.
// SameSite=Strict: the browser sends the cookies only to same-site requests. localhost:3000 and localhost:4000
// are the same site (ports are ignored), so every micro-frontend gets them, while other sites cannot make
// the browser send them (CSRF). Secure is off because dev runs on plain http.
const BASE_OPTIONS: CookieOptions = { httpOnly: true, sameSite: 'strict', secure: false };

// The access cookie outlives its JWT on purpose: an expired token must reach the API and get a 401,
// which is the client's signal to refresh. The refresh cookie is sent only to /auth/*.
const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  path: '/',
  maxAge: REFRESH_TOKEN_TTL_MS,
};
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  path: '/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
};

export function setAuthCookies(response: Response, tokens: AuthTokens): void {
  response.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_COOKIE_OPTIONS);
  response.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearAuthCookies(response: Response): void {
  response.clearCookie(ACCESS_TOKEN_COOKIE, { ...BASE_OPTIONS, path: '/' });
  response.clearCookie(REFRESH_TOKEN_COOKIE, { ...BASE_OPTIONS, path: '/auth' });
}

// Cookies are client input: narrow before use.
export function readCookie(request: Request, name: string): string | undefined {
  const value: unknown = (request.cookies as Record<string, unknown> | undefined)?.[name];
  return typeof value === 'string' ? value : undefined;
}
