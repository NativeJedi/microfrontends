import { SESSION_SERVICE } from '@mf/api-client';
import { useService } from '@mf/services';
import { useSyncExternalStore } from 'react';

export function useIsLoggedIn(): boolean {
  const session = useService(SESSION_SERVICE);
  return useSyncExternalStore(session.subscribe, session.isLoggedIn);
}
