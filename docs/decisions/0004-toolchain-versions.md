# 0004 — Toolchain versions: TypeScript 6 and ESLint 9

- Status: accepted
- Date: 2026-10-14
- Iteration: 00

## Context
SPEC section 4 says to install the current stable versions in iteration 0. At that moment `latest` is
TypeScript 7.0.2 and ESLint 10.12, but their ecosystem has not caught up:
- `typescript-eslint` declares the peer range `typescript >=4.8.4 <6.1.0`.
- `eslint-plugin-react` declares the peer range `eslint ^9.7` at most.

## Options
1. **TypeScript 6.0.3 + ESLint 9.39** — newest versions that every plugin in the lint stack supports.
2. **TypeScript 7.0.2 + ESLint 9.39** — newest `tsc`, but type-aware lint rules are not supported,
   so pnpm peer overrides would be needed.
3. **TypeScript 7 + ESLint 10, ignore peer warnings** — everything at `latest`, lint likely breaks.

## Decision
Option 1. The goal of the project is Module Federation, not toolchain debugging. Everything else
uses the current stable version.

## Consequences
- `typescript` is pinned with `~6.0.3`, `eslint` and `@eslint/js` stay on `^9`.
- Revisit when `typescript-eslint` and `eslint-plugin-react` publish releases that support TS 7 /
  ESLint 10 (a dependency bump, not an architecture change).
