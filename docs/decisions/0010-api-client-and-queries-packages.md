# 0010 — Stateless `@mf/api-client` and `@mf/queries` packages; stateful instances come from the shell

- Status: accepted
- Date: 2026-10-17
- Iteration: 05

## Context
In the first version of iteration 05, `@mf/contracts` held routes, events, API types, the fetch helper, query keys and
`queryOptions`. It depended on `@tanstack/react-query`, and it was not clear from the structure where HTTP ends and
caching starts. Iteration 08 adds a stateful HTTP client (access token, single-flight refresh), which must exist
once per page. Workspace packages are bundled into every app that imports them (they are not MF-shared), so any
module-level state in a package is duplicated per app.

## Options
1. **Keep everything in `@mf/contracts`** — one package; mixes contracts, HTTP and cache; contracts depends on react-query.
2. **Split into stateless packages; the shell creates stateful instances and passes them to remotes** — clear layers;
   instances are explicit in the props of each expose.
3. **Stateful client package shared as an MF singleton** — one instance through the share scope; breaks silently when
   one app forgets the `shared` entry (same failure as iteration 05 Problem 2).
4. **Shell exposes the client via MF (`shell/api-client`)** — one instance by container; adds a remote → shell
   runtime dependency that props do not need.

## Decision
Option 2.

| Package | Holds | Depends on |
|---|---|---|
| `@mf/contracts` | `ROUTES`, cross-app events | — |
| `@mf/api-client` | API response types, request functions (`getProducts`, `createOrder`, …) | — (no React, no cache) |
| `@mf/queries` | key factories, `queryOptions` factories with `staleTime` | `@mf/api-client`, `@tanstack/react-query` |

Rules:
- Packages are **stateless**: functions, types, factories. No module-level mutable state.
- A stateful instance (the `QueryClient` today, the authenticated HTTP client in iteration 08) is created once by the
  shell's `bootstrap.tsx` from library or package code. The `QueryClient` reaches remotes through React context
  (`@tanstack/react-query` is an MF singleton); the HTTP client of iteration 08 will reach them through the props of
  their exposes. A standalone remote creates its own instances in its `bootstrap.tsx`.
- Mutations used by a single app stay in that app (`usePlaceOrder` in cart) and use the request function from
  `@mf/api-client` and the keys from `@mf/queries`.

## Consequences
- Each layer can be read and changed on its own; `@mf/contracts` no longer depends on react-query.
- Two more packages (`package.json`, `tsconfig.json`), and apps list the ones they import.
- Bundled per app: a change of a key or request function needs a redeploy of every app that uses it (as before).
- Iteration 08: `@mf/api-client` gets a factory for the authenticated client; its interface becomes part of the
  expose props contract (additive changes only, ADR 0008), and query options receive the client as a parameter.
