# 0003 — Server state in TanStack Query, shared client state in Zustand

- Status: accepted (store sharing mechanism decided in iteration 05)
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
- `@tanstack/react-query` and `zustand` must be MF singletons.
- Query keys are part of the public contract — changing them is a breaking change.
- Open: how the Zustand store instance is shared (MF expose vs shared package) — iteration 05.
