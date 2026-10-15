# 0007 — React Router 8 (`react-router`) instead of `react-router-dom`

- Status: accepted
- Date: 2026-10-15
- Iteration: 03

## Context
SPEC named `react-router-dom` as the routing package and listed it as an MF singleton. At the start of
iteration 03 the current stable releases are:
- `react-router` **8.4.0** (`latest`) — one package that contains everything, including the DOM APIs
  (`BrowserRouter`, `Link`, `NavLink`) and declarative mode (`<Routes>` / `<Route>`).
- `react-router-dom` **7.18.4** (`latest` of that package) — not released for v8. In v7 it only re-exports
  `react-router` (`dependencies: { "react-router": "7.18.4" }`).

SPEC section 4 requires current stable versions.

## Options
1. **`react-router` 8, shared as a singleton** — current stable, one package, one shared key.
   Peer dependency `react >= 19.2.7` is satisfied (19.3.0). Requires renaming the package in SPEC.
2. **`react-router-dom` 7 as in SPEC** — no SPEC change, but already one major behind. The shim re-exports
   `react-router`, so both packages must be shared: if only `react-router-dom` is shared and any code imports
   `react-router` directly, that import gets another copy with its own contexts.

## Decision
Option 1. All apps depend on `"react-router": "catalog:"` (`^8.4.0` in the pnpm catalog) and share it with
`singleton: true`, `requiredVersion: ^<installed>`, `strictVersion: false` (ADR 0005 policy).
Imports come only from `react-router`; `react-router-dom` is not installed.

## Consequences
- SPEC sections 4 and 7 name `react-router`.
- v8 behaviors met in this iteration (details in `docs/notes/03-routing.md`):
  - relative links inside a splat route resolve against the full URL (the `v7_relativeSplatPath` behavior
    is the default since v7), so links use route constants;
  - `<Link>` outside a router fails with a `TypeError` while reading the router context, before the
    `useHref() may be used only in the context of a <Router> component.` check runs.
- Future upgrades of the router are coordinated like React: the shell first, remotes follow.
