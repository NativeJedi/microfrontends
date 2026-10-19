// The client never sees a token (both live in httpOnly cookies), so the only session state in JS is this flag.
// It is a UI hint, not a proof: the API decides. A stale flag ends at the first 401 that a refresh cannot fix.
export interface Session {
  isLoggedIn(): boolean;
  start(): void;
  end(): void;
  // useSyncExternalStore-compatible. Also fires when another tab of the same origin changes the flag.
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'auth:is-logged-in';
const LOGGED_IN = 'true';

// localStorage can throw (blocked storage, private mode): treat that as "not logged in".
function readFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === LOGGED_IN;
  } catch {
    return false;
  }
}

function writeFlag(isLoggedIn: boolean): void {
  try {
    if (isLoggedIn) localStorage.setItem(STORAGE_KEY, LOGGED_IN);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The in-memory value still drives this tab; other tabs just will not be told.
  }
}

export function createSession(): Session {
  const listeners = new Set<() => void>();
  let isLoggedIn = readFlag();

  function update(nextIsLoggedIn: boolean): void {
    if (nextIsLoggedIn === isLoggedIn) return;
    isLoggedIn = nextIsLoggedIn;
    listeners.forEach((listener) => listener());
  }

  // The `storage` event fires in every other tab of this origin when the flag changes: logout (or login)
  // in one tab reaches the rest without a separate BroadcastChannel.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === null) update(readFlag());
  });

  return {
    isLoggedIn: () => isLoggedIn,
    start() {
      writeFlag(true);
      update(true);
    },
    end() {
      writeFlag(false);
      update(false);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
