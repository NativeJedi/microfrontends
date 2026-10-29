import type { Session } from './session';

// Static for dev; becomes runtime environment config in iteration 13.
const API_BASE_URL = 'http://localhost:4000';

export interface Credentials {
  email: string;
  password: string;
}

export interface ApiClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  login(credentials: Credentials): Promise<void>;
  logout(): Promise<void>;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Stateful: the refresh in flight is shared by every request of this instance. That is why there must be
// exactly one instance per page (created by the shell, resolved by remotes from the service container):
// one instance per app would mean one refresh per app, and refresh token rotation lets only the first succeed.
export function createApiClient(session: Session): ApiClient {
  let refreshInFlight: Promise<boolean> | null = null;
  let completedRefreshes = 0;

  // Cookies are sent cross-origin (localhost:3000 → :4000) only with credentials: 'include'.
  function send(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });
  }

  async function postRefresh(): Promise<boolean> {
    const response = await send('/auth/refresh', { method: 'POST' });
    if (!response.ok) {
      session.end();
      return false;
    }
    completedRefreshes += 1;
    return true;
  }

  // Single-flight: concurrent 401s wait for the same refresh request instead of starting their own.
  function refreshOnce(): Promise<boolean> {
    refreshInFlight ??= postRefresh().finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  async function retryAfterRefresh(path: string, init?: RequestInit): Promise<Response> {
    const response = await send(path, init);
    // Fresh cookies and still 401: the session is not usable, so do not loop into another refresh.
    if (response.status === 401) session.end();
    return response;
  }

  async function sendWithRefresh(path: string, init?: RequestInit): Promise<Response> {
    const refreshesAtSend = completedRefreshes;
    const response = await send(path, init);
    if (response.status !== 401) return response;
    // Sent with the old cookie, answered after another refresh had finished: the cookie is new, just retry.
    if (completedRefreshes !== refreshesAtSend) return retryAfterRefresh(path, init);
    return (await refreshOnce()) ? retryAfterRefresh(path, init) : response;
  }

  return {
    async request<T>(path: string, init?: RequestInit) {
      const response = await sendWithRefresh(path, init);
      if (!response.ok) {
        throw new HttpError(
          response.status,
          `${init?.method ?? 'GET'} ${path} failed: ${response.status}`,
        );
      }
      // Our own API: response bodies are trusted like typed imports (no runtime schema yet).
      return (await response.json()) as T;
    },

    // Auth endpoints bypass the refresh logic: a 401 from login means wrong credentials.
    async login(credentials) {
      const response = await send('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!response.ok) throw new HttpError(response.status, `Login failed: ${response.status}`);
      session.start();
    },

    async logout() {
      try {
        await send('/auth/logout', { method: 'POST' });
      } finally {
        session.end();
      }
    },
  };
}
