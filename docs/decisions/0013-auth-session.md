# 0013 — Auth: tokens in httpOnly cookies, one API client per page through a shared service container

- Status: accepted
- Date: 2026-10-19
- Iteration: 08

## Context
Iteration 08 adds login, protected routes and short-lived access tokens with rotating refresh tokens. Four apps call
the API. A refresh token works once (rotation), so the code that refreshes must be one instance per page: workspace
packages are bundled into every app, and module-level refresh state there would exist once per app. Three
simultaneous 401s would then send three refreshes with the same token. SPEC planned "access token in memory, refresh
token in an httpOnly cookie". ADR 0009 said the shell would expose the session like `cart/store`, and ADR 0010 said
the HTTP client would reach remotes through expose props. Four decisions are needed: where the tokens live, what the
client keeps as session state, how the one client instance reaches remotes, and how other tabs learn about logout.

## Options
Token storage:
1. **Access token in memory, refresh token in an httpOnly cookie** (SPEC plan) — works with an API on any domain
   (`Authorization` header). − JS holds the token (XSS can read it). The token is lost on every reload, so each page
   load starts with a refresh.
2. **Both tokens in httpOnly cookies** — JS never sees a token, and a reload needs no refresh. − Cookies are sent
   automatically, so CSRF (Cross-Site Request Forgery) must be handled (`SameSite`). The API must share a site with
   the apps, otherwise the cookies become third-party and browsers block them.
3. **Tokens in `localStorage`** — simplest. − Any injected script reads them. Rejected.

Session state in JS (with option 2): a `localStorage` flag `auth:is-logged-in` vs a `GET /me` request at start-up.
The flag needs no endpoint, survives reloads and changes in other tabs fire a `storage` event. It is only a hint:
the API stays the authority.

Delivery of the one instance to remotes:
1. **Expose props** (ADR 0010) — explicit in each expose's types. − Every expose gets a required prop, which is a
   breaking contract change (ADR 0008). Every new service changes every expose.
2. **`shell/session` expose** (ADR 0009 wording) — one instance by container. − Circular runtime dependency
   host ↔ remotes. Standalone remotes need the shell running.
3. **Generic service container (`@mf/services`) as an MF shared singleton** — the shell registers instances under
   string keys, and remotes call `useService(key)` through a React context. Expose props do not change, and new
   services are additive. − The dependency on a provider is not visible in expose types. The package must be in
   `shared` in every app, otherwise that app gets its own context and `useService` throws.
4. **Stateful client package as an MF shared singleton** (ADR 0010 option 3) — the shared module itself holds the
   refresh state. − Forgetting `shared` in one app silently creates a second client with its own refresh, which is
   exactly the bug we are preventing.

Cross-tab logout: `BroadcastChannel` (ROADMAP wording) vs the `storage` event on the flag that already lives in
`localStorage`.

## Decision
- **Both tokens in httpOnly cookies.** `access_token`: `Path=/`, a JWT (JSON Web Token) valid for 30s. The cookie
  lives as long as the refresh token, so an expired JWT still reaches the API and yields 401. `refresh_token`: an
  opaque random value with `Path=/auth`, 7d, rotated on every refresh. Reuse of a used refresh token revokes the
  whole family (login). Both cookies use `SameSite=Strict`: all `localhost` ports are one site. `Secure` is off
  only in dev (http).
- **API rules:** a global guard. `@AuthMode('required')` is the default. `'optional'` (products) lets anonymous
  requests through but rejects a present invalid token with 401 ("bad credentials"). `'none'` (auth endpoints)
  ignores the access token. A failed refresh clears both cookies.
- **Client:** `createSession()` (the flag, `subscribe` with the `storage` event) and `createApiClient(session)`
  (`credentials: 'include'`, single-flight refresh on 401, one retry; a failed refresh or a 401 after a successful
  refresh → `session.end()`), both in `@mf/api-client`, no React.
- **Delivery: option 3.** `@mf/services` knows nothing about concrete services: `defineServiceKey<T>(name)`,
  `createServiceContainer()`, `ServicesProvider`, `useService(key)`. Keys are strings, because an object key would
  be a different object in each app's bundle. Keys of the API client and the session live next to them in
  `@mf/api-client` (`API_CLIENT_SERVICE`, `SESSION_SERVICE`). This supersedes the "through props" part of ADR 0010
  and the "shell exposes the session" sentence of ADR 0009.
- **Cross-tab logout through the `storage` event.** Session end in any tab → the shell clears the query cache and
  dispatches `shell:logged-out`, and cart clears its store.
- New API dependencies: `@nestjs/jwt` (JWT signing/verification), `cookie-parser` (+ `@types/cookie-parser`,
  `@types/express`).

## Consequences
- XSS cannot steal tokens. It can still call the API while the page is open, so XSS stays critical.
- Same-site deployment is required: apps and API on one domain or subdomains of one site (iteration 13). Cross-site
  would need `SameSite=None; Secure` plus a CSRF token, and still fails where third-party cookies are blocked.
- `@mf/services` is the first workspace package in `shared`. Its version (`1.0.0`) is a runtime contract, and service
  key names are a cross-app contract (renaming one is breaking).
- Hidden contract: an exposed module that calls `useService` must be rendered inside the host's
  `<ServicesProvider>`. Missing → a clear error, not a silent second instance.
- The session flag is per origin: standalone remotes on :3002/:3003 keep their own flag and log in with the demo
  user in dev. The cookies are shared by all ports.
- Refreshes are single-flight per tab, not across tabs: two tabs refreshing at the same moment hit reuse detection
  (known issue, see notes 08).
