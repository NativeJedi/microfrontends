# 0003 — Server state in TanStack Query, shared client state in Zustand

- Status: accepted (store sharing mechanism: [ADR 0009](0009-cart-store-exposed-by-owner.md))
- Date: 2026-10-14
- Iteration: 05

## Context
Micro-frontends need shared data (products, orders, session) and shared UI state (cart) without
one app owning everything.

## Options
1. **TanStack Query for server state + Zustand for client state** — the cache becomes the shared
   data layer; Zustand covers the small amount of true client state.
2. **One global Redux store** — strong coupling, every team depends on one store shape.
3. **Only events (CustomEvent / event bus)** — loose coupling, but no shared cache, duplicate requests.

## Decision
Option 1. One `QueryClient` created by shell; query key factories in `packages/contracts`.
Zustand for cart items and UI flags.

## Consequences
- `@tanstack/react-query` must be an MF singleton. `zustand` is not shared: store identity comes from the
  owner's exposed module (ADR 0009).
- Query keys are part of the public contract — changing them is a breaking change.
- Store sharing: the owner app exposes a narrow API (`cart/store`) — [ADR 0009](0009-cart-store-exposed-by-owner.md).
