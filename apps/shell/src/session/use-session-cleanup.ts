import { SESSION_SERVICE } from '@mf/api-client';
import { dispatchMfEvent, MF_EVENTS } from '@mf/contracts';
import { useService } from '@mf/services';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

// One place for "the session ended", whatever ended it: logout in this tab, logout in another tab
// (storage event), or a refresh that failed. The shell clears what it owns (the shared query cache) and tells
// the other apps to reset their own client state; it does not reach into their stores.
export function useSessionCleanup(): void {
  const session = useService(SESSION_SERVICE);
  const queryClient = useQueryClient();

  useEffect(() => {
    let wasLoggedIn = session.isLoggedIn();

    return session.subscribe(() => {
      const isLoggedIn = session.isLoggedIn();
      if (wasLoggedIn && !isLoggedIn) {
        queryClient.clear();
        dispatchMfEvent(MF_EVENTS.loggedOut, {});
      }
      wasLoggedIn = isLoggedIn;
    });
  }, [session, queryClient]);
}
