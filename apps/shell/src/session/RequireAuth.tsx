import { ROUTES } from '@mf/contracts';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { getCurrentPath } from './return-path';
import { useIsLoggedIn } from './use-is-logged-in';

// UX gate only: the API protects the data. When the session ends while the page is open (logout here or in
// another tab, failed refresh), this re-renders and sends the user to the login page.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const isLoggedIn = useIsLoggedIn();
  const location = useLocation();

  if (!isLoggedIn) return <Navigate to={ROUTES.login(getCurrentPath(location))} replace />;
  return children;
}
