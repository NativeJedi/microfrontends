import { ROUTES } from '@mf/contracts';

// returnTo comes from the URL, so anyone can craft it: accept only an absolute path inside this app.
// "//evil.example" and "/\evil.example" are protocol-relative URLs to another site.
function isAppPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
}

export function toSafeReturnPath(returnTo: string | null): string {
  return returnTo !== null && isAppPath(returnTo) ? returnTo : ROUTES.catalog.root;
}

export function getCurrentPath(location: { pathname: string; search: string }): string {
  return `${location.pathname}${location.search}`;
}
