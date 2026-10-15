# 05 — State: TanStack Query + Zustand

> Challenge: #1

## Problem
Micro-frontends on one page need the same data (products, orders) and the same client state (cart items). If every
app keeps its own copy, the page makes duplicate requests, an order placed in cart does not show up in account, and the
header counter does not move when catalog adds a product. If one app owns one global store for everything, every team
is coupled to its shape and release cycle. The task: one server cache, client state with a clear owner, and no hidden
coupling between independently deployed apps.

## Solution
- **API.** `services/api` (NestJS (Node.js framework), in-memory, :4000): `GET /products`, `GET /products/:id`,
  `GET /orders`, `POST /orders` (`{ items: { productId, quantity }[] }`, names, prices and total computed on the
  server, body narrowed from `unknown`). CORS for :3000–3003 with credentials.
- **One server cache.** `@tanstack/react-query` is an MF singleton in all four apps; the shell creates the only
  `QueryClient` in `bootstrap.tsx`:
  ```tsx
  const queryClient = new QueryClient();
  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><App /></BrowserRouter>
    </QueryClientProvider>,
  );
  ```
  Each remote's standalone `bootstrap.tsx` creates its own client; nothing in `exposed/` does.
- **Query contract in `@mf/contracts`** (`src/api.ts`): API types, key factories and `queryOptions` factories.
  ```ts
  export const productKeys = {
    all: ['products'] as const,
    list: () => [...productKeys.all, 'list'] as const,
    detail: (productId: string) => [...productKeys.all, 'detail', productId] as const,
  };
  export const productQueries = {
    list: () => queryOptions({
      queryKey: productKeys.list(),
      queryFn: () => fetchJson<Product[]>('/products'),
      staleTime: STALE_TIME_MS, // 60 s
    }),
  };
  ```
  catalog uses `productQueries.list()/detail(id)`, cart joins its lines with `productQueries.list()` (cache filled by
  catalog), account uses `orderQueries.list()`.
- **Cross-app invalidation.** Cart's `usePlaceOrder` mutation: `onSuccess` → `clear()` the cart and
  `queryClient.invalidateQueries({ queryKey: orderKeys.all })`.
- **Client state owned by cart** ([ADR 0009](../decisions/0009-cart-store-exposed-by-owner.md)). `apps/cart/src/cart-store.ts`:
  Zustand store with `lines`, `isMiniCartOpen`, `persist` (`cart:items`, only `lines`, `version: 1`, persisted value
  narrowed on load). Exposed as a narrow API:
  ```ts
  // apps/cart/src/exposed/store.ts  →  exposes: { './store': './src/exposed/store.ts' }
  export function addToCart(productId: string): void {
    useCartStore.getState().addItem(productId);
  }
  export function useCartQuantity(productId: string): number {
    return useCartStore((state) => state.lines.find((line) => line.productId === productId)?.quantity ?? 0);
  }
  ```
  catalog: `remotes: { cart: 'cart@http://localhost:3002/remoteEntry.js' }`, `"cart": "workspace:*"` for types,
  `AddToCartButton` on the list and details pages. The header counter is still `cart/CartWidget` (cart's own code in
  the shell header); it now reads the store and toggles the mini-cart. `addItem` opens the mini-cart.
- `zustand` is **not** in any `shared` config: only cart imports it. `turbo.json`: `types` depends on `^types`
  (catalog's declarations import `cart/store`).

Verified in the browser (shell :3000): adding from catalog updates "Cart (N)" and opens the mini-cart at once; the
catalog button shows "(2 in cart)"; navigation catalog → cart → catalog → account → cart made exactly one
`GET /products`; placing an order → `POST /orders` → account orders shows `o-1003` without a reload (second
`GET /orders` caused by the invalidation); the cart survives a refresh; `__mfDebug()` lists one
`@tanstack/react-query` provided by shell and no `zustand`; standalone :3001, :3002, :3003 work; clean console.
`pnpm build`, `pnpm typecheck`, `pnpm lint` pass.

## How it works

### Why the provider in the shell reaches a remote
`QueryClientProvider` puts the client into a React context, and the context object is created once, at module level,
inside `@tanstack/react-query`. `useQuery` in catalog finds the shell's client only if catalog's `useQuery` and the
shell's `QueryClientProvider` come from the **same module instance** of the library — that is what
`singleton: true` in the share scope guarantees. Same reasoning as `react-router` in iteration 03.

### Why the cart store is one instance
`useCartStore` is created when `cart-store.ts` is evaluated. Everybody reaches that module through the `cart` container:

| Who | Import | Path to the module |
|---|---|---|
| shell header | `cart/CartWidget` → `../cart-store` | shell → `cart` container → module cache |
| cart page | `cart/App` → `../cart-store` | same container, same cache |
| catalog | `cart/store` → `../cart-store` | catalog → `cart` container (same `remoteEntry.js`, same global `cart`) → same cache |

A container is a webpack runtime with its own module cache; there is one `cart` container per page, so the module is
evaluated once. No share-scope negotiation is involved — unlike option B, where identity depends on every app listing
the store package in `shared`.

### Query options instead of bare keys
A key alone is a weak contract: if catalog stores `Product[]` under `['products','list']` and another app fetches a
different shape into the same key, both read each other's data. `queryOptions` binds key, fetcher, response type and
`staleTime`, so every app reading `productQueries.list()` gets the same data with the same freshness rules.

### What invalidation does here
`invalidateQueries({ queryKey: orderKeys.all })` marks every query whose key starts with `['orders']` as stale and
refetches the ones currently mounted. The account orders page is not mounted while the user is in cart, so it is only
marked stale; navigating to account mounts the query and triggers the refetch. Without the invalidation, account would
show the cached list (fresh for 60 s) without the new order.

## What can go wrong

### 1. `@tanstack/react-query` not shared
- **Scenario:** a remote (here account, confirmed by an uncommitted experiment) drops `@tanstack/react-query` from its
  `shared` config, or lists it without `singleton`.
- **Symptom:** opening `/account/orders` in the shell blanks the whole page:
  `Uncaught Error: No QueryClient set, use QueryClientProvider to set one`
  (no error boundary yet — iteration 09). Standalone account still works, so the bug hides until the remote is hosted.
  Variant: the remote "fixes" it by wrapping its exposed `./App` in its own `QueryClientProvider` → no error, but two
  caches: duplicate `GET /products`, and cart's invalidation of `orderKeys.all` never reaches account's cache.
- **Root cause:** account bundles its own copy of the library, with its own context object; the shell's provider fills
  the shell's context, account's `useQuery` reads the empty one.
- **Fix:** `singleton: true` + explicit `requiredVersion` in every app (SPEC section 7); providers only in
  `bootstrap.tsx`; check with `__mfDebug()` — one row for `@tanstack/react-query`, `loaded: true`.

### 2. Store module imported but not shared
- **Scenario (option B, from ROADMAP):** `@mf/store` is a workspace package; one app imports it but forgets the
  `shared` entry, so webpack bundles a private copy.
  **Same failure in our option C** (confirmed by an uncommitted experiment): catalog imports cart's store by file path
  (`'../../../cart/src/exposed/store'`) instead of through `cart/store`.
- **Symptom:** no error at all. Clicking "Add to cart" twice: catalog's button says "(2 in cart)", the header still
  says "Cart (0)". `localStorage['cart:items']` contains the 2 items because both copies persist to the same key — after
  a refresh the header shows 2, then the copies diverge again and overwrite each other's saved state.
- **Root cause:** two evaluations of the store module → two `create()` calls → two stores. Identity of a module-level
  singleton is per bundle/container, not per package name.
- **Fix:** for C — import other apps' state only through their expose (a relative path into another app is a review
  red flag; the `cart` package `exports` only types, so `cart/store` cannot resolve to source by accident). For B —
  `singleton: true` for the store package in **every** app and a check in `__mfDebug()`.

### 3. Hosted remote follows the host's `QueryClient` defaults
- **Scenario:** catalog relies on `staleTime` set in its standalone `new QueryClient({ defaultOptions })`.
- **Symptom:** standalone it fetches once; hosted it refetches on every mount (the shell's client has default
  `staleTime: 0`).
- **Root cause:** the client — and its defaults — belongs to the host.
- **Fix:** put cache settings into the shared `queryOptions` (what we did), never into client defaults.

### 4. Remote-to-remote dependency (cost of option C)
- **Scenario:** cart's dev server or deployment is down.
- **Symptom:** catalog cannot load either — `AddToCartButton` imports `cart/store` statically, so catalog's chunk
  waits for `cart`'s `remoteEntry.js`. Standalone catalog (:3001) needs cart on :3002.
- **Fix:** iteration 09 — load `cart/store` lazily behind an error boundary and hide the button when cart is down.

### 5. Persisted state is per origin
A standalone cart on :3002 shows an empty cart while the shell on :3000 has items: `localStorage` is scoped by origin
(scheme + host + port), unlike cookies. In production all apps are served under one origin, so it only affects
standalone dev.

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| **C. Owner exposes a narrow API (`cart/store`)** — chosen | domain ownership; state shape private; identity by container, no share-scope config | remote → remote runtime dependency; cart outage breaks callers until iteration 09 |
| A. Shell exposes the store | one place for all shared state | cart domain inside the shell; host ↔ remote cycle; shell deploy for every cart change |
| B. `@mf/store` as MF singleton | works standalone with no other server | identity depends on every app's `shared`; highest version wins at runtime; no single owner |
| Events only (`CustomEvent`, BroadcastChannel) | loosest coupling | no shared cache, duplicate requests; late subscribers miss state (iteration 04) |
| One global Redux store | one model, devtools | every team coupled to one shape and release |

## Interview questions
- **Q:** Server state vs client state — why two tools?
  **A:** Server state is a cache of data owned by the backend: it needs dedup, staleness, refetch, invalidation —
  TanStack Query. Client state is owned by the UI (cart before checkout, open flags): small, synchronous — Zustand. In
  micro-frontends the query cache becomes the shared data layer, and only a little true client state is left to share.
- **Q:** Why not one global Redux store for all micro-frontends?
  **A:** It is a shared monolith in disguise: every team depends on one state shape and reducer set, a change needs a
  coordinated deploy, and the host must know every slice. Per-domain stores with narrow exposed APIs keep deploys independent.
- **Q:** How do you guarantee one store instance across micro-frontends with Module Federation?
  **A:** Either one container owns the module and others import it through an expose (identity by container module
  cache), or the store package is a `singleton` in every app's share scope (identity by negotiation — breaks silently
  when one app forgets it). We chose the first, owned by the domain app.
- **Q:** What breaks if `@tanstack/react-query` is not shared?
  **A:** `No QueryClient set, use QueryClientProvider to set one` — two copies of the library have two contexts. If a
  remote adds its own provider instead, it silently gets a second cache: duplicate requests, invalidation does not cross apps.
- **Q:** Query keys across teams?
  **A:** They are a public contract: key factories (better, `queryOptions`) in a shared contracts package; renaming a
  key is a breaking change; invalidate by prefix (`orderKeys.all`).
- **Q:** Risks of a shared store?
  **A:** Unclear ownership, hidden coupling to the state shape, version skew at runtime, and a single failure point.
  Mitigate with one owner, functions instead of the raw store, additive changes only, error boundaries.
- **Q:** Alternatives to sharing a store?
  **A:** Custom events (fire-and-forget, no replay), BroadcastChannel (also across tabs), URL as state, or the server as
  the source of truth (cart on the API + query invalidation).

## Links
- TanStack Query: [QueryClientProvider](https://tanstack.com/query/latest/docs/framework/react/reference/QueryClientProvider),
  [queryOptions](https://tanstack.com/query/latest/docs/framework/react/guides/query-options),
  [Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)
- Zustand: [persist middleware](https://zustand.docs.pmnd.rs/integrations/persisting-store-data)
- Webpack: [Module Federation — shared](https://webpack.js.org/plugins/module-federation-plugin/#sharing-hints)
- NestJS: [CORS](https://docs.nestjs.com/security/cors)
