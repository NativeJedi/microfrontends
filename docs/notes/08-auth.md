# 08 — Auth and session

> Challenge: #12

## Problem
Every micro-frontend calls the API, and all of them need the same logged-in user. Access tokens are short-lived, so
any request can get a 401 and needs a refresh. Refresh tokens rotate: each one works once. If every app owns its own
fetch wrapper, three apps that get a 401 at the same moment send three refreshes with the same token. The server sees
a reused token and revokes the session. Logout has the same problem in space instead of time: other apps and other
tabs keep their state and still think the user is logged in.

## Solution
- **API** (`services/api/src/auth/`): `POST /auth/login`, `POST /auth/refresh` (rotation + reuse detection),
  `POST /auth/logout`. All three answer 204 and set or clear cookies, with no token in the body.
  - `access_token`: a JWT (JSON Web Token) valid for 30s (short on purpose for demos). The cookie is `httpOnly`,
    `SameSite=Strict`, `Path=/`, and lives as long as the refresh token, so an expired JWT reaches the API and gets
    a 401.
  - `refresh_token`: opaque (`crypto.randomBytes`), `httpOnly`, `SameSite=Strict`, `Path=/auth`, 7 days, kept in
    an in-memory `Map` with `{ userId, familyId, used, expiresAt }`.
  - A global guard with `@AuthMode('required' | 'optional' | 'none')`: orders are required (default), products are
    optional (anonymous OK, a bad token → 401), and auth endpoints are none (refresh works with an expired access
    cookie).
- **`@mf/api-client`** (no React):
  ```ts
  const session = createSession();          // flag `auth:is-logged-in` in localStorage + `storage` event
  const api = createApiClient(session);     // credentials: 'include', single-flight refresh
  getOrders(api);                           // request functions take the client
  ```
  ```ts
  // inside createApiClient: concurrent 401s share one refresh
  function refreshOnce(): Promise<boolean> {
    refreshInFlight ??= postRefresh().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }
  ```
  Rule: 401 → one refresh → one retry. If the refresh fails, or the retry is 401 again → `session.end()`.
  A request that was sent before a refresh finished and answered after it is just retried, with no second refresh
  (`completedRefreshes` counter).
- **`@mf/services`**: a generic service container, an MF shared singleton in all four `webpack.config.js`:
  ```ts
  // shell bootstrap.tsx
  const services = createServiceContainer();
  services.register(SESSION_SERVICE, session);
  services.register(API_CLIENT_SERVICE, createApiClient(session));
  <ServicesProvider container={services}> … </ServicesProvider>
  // any remote
  const api = useService(API_CLIENT_SERVICE);
  useQuery(orderQueries.list(api));
  ```
- **Shell**:
  - `/login` (`LoginPage`, `returnTo` query parameter limited to same-app paths).
  - `RequireAuth` around `/account/*`.
  - Log in / Log out in the header.
  - `useSessionCleanup`: when the session ends, for any reason in any tab, it runs `queryClient.clear()` and
    dispatches `shell:logged-out`.
- **Cart** clears its store on `shell:logged-out` (module-level subscription in `cart-store.ts`). An anonymous user
  sees "Log in to place an order" → `ROUTES.login(ROUTES.cart)`.
- **Standalone remotes** create their own session, client and container. In dev, cart and account log in as the demo
  user (`DEV_CREDENTIALS`) with top-level `await` before rendering.

## How it works
- **Why the client must be one instance.** `refreshInFlight` is a variable inside one `createApiClient` call. Workspace
  packages are bundled into each app (ADR 0010), so only the instance created by the shell and resolved by everyone
  gives one variable per page. The `@mf/services` package does not hold that state. It holds only the React
  context, and the context must be one object, so the package is `shared` (`__mfDebug()`: one `@mf/services` 1.0.0,
  provided by `shell`, loaded).
- **Why keys are strings.** `defineServiceKey<ApiClient>('api-client')` returns the string `'api-client'` with a
  phantom type. `@mf/api-client` is bundled into every app, so a `Symbol()` or `{}` key would be a new value in each
  bundle, and `Map.get` in the shell's container would miss it. Strings are equal across bundles.
- **Cookies across ports.** `localhost:3000` → `localhost:4000` is cross-origin (ports differ) but same-site (site =
  scheme + registrable domain, ports ignored). So `SameSite=Strict` cookies are sent, but only when `fetch` asks for
  it (`credentials: 'include'`) and the API answers with `Access-Control-Allow-Origin: <exact origin>` plus
  `Access-Control-Allow-Credentials: true` (`enableCors({ origin: DEV_ORIGINS, credentials: true })`).
- **The flag is a hint.** `localStorage` is untrusted and per origin. A stale `true` costs one 401 → refresh 401 →
  logout. The API decides everything.
- **Verified in the browser** (dev, demo user):
  - `/account` → `/login?returnTo=%2Faccount` → login → `/account/profile`.
  - On `/account/orders` with the mini-cart open, after 65s (token expired, queries stale) a `visibilitychange`
    gives `/orders 401`, `/products 401`, `/auth/refresh 204` (one), `/orders 200`, `/products 200`.
  - Logout in one tab → the second tab on `/account/orders` moves to `/login`, `Cart (0)`, flag removed.
  - API restarted (refresh tokens lost) → `/auth/refresh 401` → logged out, redirected. `/catalog` works
    anonymously (cookies cleared by the failed refresh).
  - Cart "Log in to place an order" → login → back to `/cart` → order placed.
  - Standalone :3001–:3003 work, with the dev login on :3002/:3003.

## What can go wrong

### 1. Each app has its own fetch with its own refresh → the session is revoked
- **Scenario:** catalog, cart and account each bundle a fetch wrapper with module-level `refreshInFlight` (or none).
  The access token expires, the tab regains focus, and TanStack Query refetches the stale queries of all three apps
  at once.
- **Symptom:** three `POST /auth/refresh` requests with the same cookie. Confirmed with three parallel `curl`
  calls: one `204`, two `401 {"message":"Refresh token is missing, expired or already used","error":"Unauthorized",
  "statusCode":401}`. After that, even the winner's new refresh token gets `401`: the family is revoked. In the
  browser the user is logged out a few seconds after the token expiry, "randomly", only when several apps are on
  screen.
- **Root cause:** single-flight works only inside one instance. Bundled packages give one instance per app, and
  rotation with reuse detection treats the second use of a token as theft.
- **Fix:** (chosen) one client per page, created by the shell and resolved from the shared container. Alternatives:
  a server grace period (the old token stays valid for a few seconds after rotation and returns the same new pair),
  which hides the race but weakens theft detection; a shared-singleton client module (ADR 0010 option 3), which
  fails silently when one app forgets `shared`; refreshing in a Service Worker or a BFF (Backend For Frontend), so the
  browser code never refreshes.

### 2. The container context or a key from a non-shared copy → "no provider" / "not registered"
- **Scenario A:** a remote forgets `'@mf/services'` in `shared`. It bundles its own copy, with its own
  `createContext`, so `useContext` in the remote does not see the shell's provider.
- **Symptom A:** the remote's route crashes with
  `useService("api-client") has no <ServicesProvider> above it. Is @mf/services a shared singleton in this app?`
  (the message thrown by `useService`, by construction, not reproduced in the browser; standalone mode still works because the remote's own bootstrap provides its own copy, so
  the bug shows up only after integration).
- **Scenario B:** keys are created as `Symbol('api-client')` or objects.
- **Symptom B:** `Service "Symbol(api-client)" is not registered`. The shell registered its Symbol, the remote looks
  up its own.
- **Root cause:** module identity. A module evaluated once per bundle produces different objects per app. Only MF
  `shared` (one module instance) or primitive values (strings) are equal across apps.
- **Fix:** (chosen) `@mf/services` in `shared` with `singleton: true` in every app, and string keys. The error
  messages say what is missing instead of silently creating a second instance.

### 3. Logout in one tab leaves other tabs logged in
- **Scenario:** the user logs out in tab A. Tab B keeps its query cache (orders), its cart store and its "logged in"
  UI until the next 401.
- **Symptom:** tab B still shows the account page and the cart of the previous user. With shared computers this is a
  data leak.
- **Root cause:** in-memory state is per tab. Cookies are cleared for everyone, but nothing tells tab B to drop what
  it already holds.
- **Fix:** (chosen) the session flag lives in `localStorage`, and removing it fires a `storage` event in every other
  tab of the origin. The session ends there too, `useSessionCleanup` clears the query cache and dispatches
  `shell:logged-out`, cart clears its store, and `RequireAuth` redirects. Alternatives: `BroadcastChannel('auth')`
  (explicit messages, not tied to storage; needs its own message protocol); polling `/me`; just waiting for the
  next 401 (leaves stale UI until then).

### 4. Two tabs refresh at the same time (known issue, not fixed)
- **Scenario:** two tabs are open, the token is expired, and both tabs get focus or reload at nearly the same moment.
  Each tab has its own client, so single-flight does not cover the other tab.
- **Symptom:** the same as problem 1, but across tabs: one refresh wins, the other is a reuse, and the session is
  revoked in both.
- **Fix options:** the Web Locks API (`navigator.locks.request('auth:refresh', () => postRefresh())`) serializes
  refreshes across tabs of one origin. The cookie is shared, so the second tab refreshes with the already rotated
  token. Alternatively, a server grace period, or a refresh in a SharedWorker/Service Worker. Not done: it is not
  MF-specific (same in any SPA), and it is rare in a demo.

### 5. Cookies and CORS when apps live on different origins or sites
- **Scenario:** the API is called without `credentials: 'include'`, the API answers `Access-Control-Allow-Origin: *`,
  or the apps move to a different site than the API.
- **Symptom:** no cookie on the request → `401 Not logged in` right after a successful login. With `*` plus
  credentials, Chrome blocks the response: "The value of the 'Access-Control-Allow-Origin' header in the
  response must not be the wildcard '*' when the request's credentials mode is 'include'". On a different site,
  `SameSite=Strict/Lax` cookies are never sent, and `SameSite=None` cookies are blocked as third-party in more and
  more browsers.
- **Root cause:** cookies follow the site, CORS follows the origin, and both must allow credentials explicitly.
- **Fix:** (chosen) same site: one domain with path-based routing, or subdomains of one domain
  (`shop.example.com`, `api.example.com`; set `Domain=example.com` only if subdomains must share the cookie), exact
  origins in CORS, and `credentials: 'include'`. For cross-site deployments, use a BFF on the app's domain or bearer
  tokens in memory (option 1 of ADR 0013).

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| Both tokens in httpOnly cookies (chosen) | No token in JS; no refresh on reload; no header injection | CSRF to handle (SameSite); same-site deployment required |
| Access in memory + refresh cookie | Works with any API domain; no CSRF on API calls | Token readable by XSS; refresh on every page load |
| Service container as shared singleton (chosen) | Expose props unchanged; new services are additive; loud failure on misconfiguration | Dependency not visible in expose types; one more shared package |
| Client instance in expose props | Explicit in types; no shared config | Required prop on every expose (breaking); prop drilling inside remotes |
| `shell/session` expose | One instance by container | Circular host ↔ remote; standalone needs the shell |
| `storage` event (chosen) | Comes for free with the flag | Tied to `localStorage`; same origin only |
| `BroadcastChannel` | Explicit messages | Separate channel and protocol; same origin only |

## Interview questions
- **Q:** Where do you store tokens in a browser app?
  **A:** Best: httpOnly cookies (or a BFF that keeps tokens server-side), so scripts cannot read them, with
  `SameSite` against CSRF and the API on the same site. If the API is on another site: access token in memory and
  refresh token in an httpOnly cookie. Never in `localStorage`. XSS stays dangerous either way: it can make requests
  as the user while the page is open.
- **Q:** Three micro-frontends get 401 at once. What happens and how do you prevent a refresh storm?
  **A:** With rotation, only the first refresh succeeds and the rest look like token theft, so the session is revoked.
  Use one HTTP client per page with a single-flight refresh (one promise that all 401s await), then retry. In MF
  this means the stateful client cannot live in a bundled package. The host creates it and remotes get it through a
  shared mechanism.
- **Q:** How do remotes get host-created services without importing the host?
  **A:** Through a React context whose module is an MF shared singleton (one context object), via props, or via a
  host expose. We use a generic DI container with string keys: the host registers, remotes resolve. Keys must be
  primitives because each bundle evaluates packages separately.
- **Q:** How do you log out every micro-frontend and every tab?
  **A:** The host owns the session. When it ends, it clears shared state it owns (query cache) and publishes an event,
  and each app resets its own state (cart clears its store). Other tabs learn through the `storage` event or
  `BroadcastChannel`.
- **Q:** What changes when apps live on different subdomains or domains?
  **A:** Subdomains of one site: cookies work (`SameSite` is site-based); CORS needs exact origins and credentials.
  Different sites: cookies become third-party (blocked or need `SameSite=None; Secure` + CSRF tokens), so prefer a
  BFF on each app's domain or bearer tokens.
- **Q:** Why validate `returnTo` after login?
  **A:** It comes from the URL, so an attacker can craft `?returnTo=//evil.example` (open redirect, phishing). Accept
  only absolute paths of the same app.

## Links
- OWASP — Session management cheat sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OAuth 2.0 for browser-based apps (refresh token rotation, BFF): https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps
- MDN — `SameSite` cookies: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value
- MDN — CORS with credentials: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#requests_with_credentials
- MDN — `storage` event: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event
- MDN — Web Locks API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
- NestJS — guards: https://docs.nestjs.com/guards
- webpack — `ModuleFederationPlugin` `shared`: https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints
