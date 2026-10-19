# 0009 — Cart state is a Zustand store owned by cart and exposed as `cart/store`

- Status: accepted (session delivery: superseded by [0013](0013-auth-session.md))
- Date: 2026-10-15
- Iteration: 05

## Context
Cart items and the mini-cart open flag are client state used by more than one micro-frontend: catalog adds
products, the cart page and the header mini-cart (`cart/CartWidget`, rendered by the shell) read them. All of them
must see the **same store instance**, otherwise the header counter does not move when catalog adds a product.
ADR 0003 chose Zustand and left open how the instance is shared. The same mechanism will be reused for the session
in iteration 08.

## Options
1. **A. Shell exposes the store (`shell/store`).** The shell becomes a remote as well; cart and catalog declare
   `remotes: { shell }`. One instance because the module is evaluated once in the shell's container.
   − Cart state lives in the app that does not own the cart domain; every cart change is a shell deploy.
   − Circular runtime dependency host ↔ remotes; standalone remotes need the shell running.
2. **B. Workspace package `@mf/store` shared as an MF singleton.** Every app bundles the store and lists it in
   `shared` (`singleton: true`, `requiredVersion` from its `package.json`); the share scope picks one copy.
   + Works standalone without other servers.
   − Identity depends on every app's `shared` config: one app without the entry silently gets its own store.
   − The highest version wins at runtime, so a change in the state shape effectively needs a coordinated deploy.
   − Shared code without a single owner.
3. **C. Cart owns the store and exposes a narrow API (`cart/store`).** The store lives in cart; `./store` exposes
   functions (`addToCart`, `useCartQuantity`), not the store or its state shape. Catalog declares
   `remotes: { cart }`. One instance because the module is evaluated once in the single `cart` container.
   + Ownership follows the domain; cart changes its store freely while the exposed functions stay compatible.
   + No share-scope negotiation, `zustand` itself does not need to be shared.
   − Remote-to-remote dependency: catalog needs cart at runtime (standalone catalog needs cart on :3002).
   − If cart is down, catalog's add-to-cart (and today the whole catalog chunk) fails — degraded mode in iteration 09.

## Decision
Option C (user decision). State is exposed by the app that owns it, as functions rather than the raw store.
The shell will expose the session the same way in iteration 08.

## Consequences
- `./store` is a contract like any expose (ADR 0008): additive changes only; types come from cart's emitted
  declarations through `package.json` `exports`.
- `zustand` is not in any `shared` config: only cart imports it.
- Catalog has `cart` in `remotes` and `"cart": "workspace:*"` in `devDependencies` (types + Turborepo order);
  `turbo.json` `types` depends on `^types`.
- Every app must resolve the remote name `cart` to the same container; remote URLs become one runtime config in
  iteration 09.
- Persisted cart lives in `localStorage` key `cart:items`, per origin: a standalone cart on :3002 does not see the cart
  of the shell on :3000.
