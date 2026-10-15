# 0008 — Contracts between micro-frontends

- Status: accepted
- Date: 2026-10-15
- Iteration: 04
- Supersedes: [0006 — types for remote modules](0006-remote-types.md)

## Context
Remotes are deployed independently, so the host runs against whatever version of a remote is deployed, not the
version it was type-checked against. ADR 0006 typed remotes with `paths` to the remotes' **source**: the host compiled
against remote internals, the `"cart": "workspace:*"` devDependency existed only to fix Turborepo caching, and the
approach does not carry over to a polyrepo. We need: a clear owner of each contract, types that travel the same way in a
monorepo and a polyrepo, rules for changing a contract without coordinated deploys, and a way to catch violations
against what is actually deployed.

## Options
Where props types of exposed modules live:
1. **Central contracts package** (`@mf/contracts` with typed `declare module 'cart/CartWidget'`) — one explicit
   contract, host decoupled from remotes; every remote change touches a second package, and in a polyrepo a separate
   repo/release for every contract change.
2. **Remote publishes emitted declarations of its exposes** — types live next to the implementation and travel as
   the remote's own artifact (`exports` → `types/*.d.ts`; in a polyrepo a scoped types package published by the remote's
   CI). No extra repo; the contract is implicit (any signature change is "published"), so the compatibility rules matter.
3. **Types downloaded from the deployed remote** (`@module-federation/dts-plugin`) — matches the deployed version; network
   at typecheck time and more tooling. Iteration 17.
4. **`paths` to remote source** (ADR 0006) — monorepo only, host checks remote internals.

Verifying contracts against deployed versions:
1. Hand-written script loading every `remoteEntry.js` and calling `container.get` — rejected: runs only in the consumer's
   CI, so it cannot catch a provider rollback, and it reinvents contract testing.
2. **Consumer-driven contract testing with a broker** (`can-i-deploy` before every deploy, including rollbacks) —
   the right tool; needs a broker and real deployments → iteration 12.
3. **Runtime validation of props / event payloads** (e.g. zod, dev-only or always) — rejected for boundaries between our
   own apps: typed + contract-tested modules are trusted like any import. A dev-only check only improves the message
   for a local version mismatch; an always-on check costs bundle size and still cannot prevent the bad deploy.
   Runtime validation stays for untrusted inputs (API responses, cross-origin `postMessage`, third-party widgets,
   `localStorage`).

## Decision
- **Option 2 for props types.** Each remote has `tsconfig.types.json` and a `types` task that emits declarations of
  `src/exposed` into `types/` (gitignored, `rm -rf` before emit so a removed expose cannot leave a stale file). Its
  `package.json` `exports` maps every expose: `"./CartWidget": { "types": "./types/exposed/CartWidget.d.ts" }`.
  The package name equals the container name, so `import('cart/CartWidget')` resolves through `node_modules/cart`
  with `moduleResolution: "Bundler"` — no `paths`. Turborepo: `typecheck` depends on `^types`; `build` no longer
  depends on `^build` (no workspace package needs a build of its dependencies).
- **`@mf/contracts` holds only cross-app pieces**: `ROUTES`, custom events (`MF_EVENTS`, payload types,
  `dispatchMfEvent`, `subscribeToMfEvent`).
- **Compatibility policy** (SPEC section 6): additive changes only; a breaking change ships under a new name
  (`./XV2`, `<app>:<event>.v2`) while the old one stays as a `@deprecated` adapter until no deployed host uses it.
- **No runtime validation** between our own apps (option 3 above).
- **Contract testing → iteration 12.**

## Polyrepo
| | Monorepo (now) | Polyrepo |
|---|---|---|
| Types artifact | `apps/cart/types/**` via `exports` | `@mf/cart` types package published by cart's CI on every release |
| Host dependency | `"cart": "workspace:*"` (devDependency) | `"@mf/cart": "^2.3.0"` (devDependency, types only) |
| Import specifier | `cart/CartWidget` resolves via package `exports` | name ≠ specifier: the package also ships an ambient shim `declare module 'cart/CartWidget' { export { default } from '@mf/cart/CartWidget'; }` referenced by the host |
| Upgrades | always the repo version | Renovate/Dependabot bump PR → host typecheck against the new types |

Use a scope for the types package: an unscoped name in a private registry is open to dependency confusion.

## Consequences
- Shell's typecheck reads only the remotes' public declarations; a breaking change in an exposed props type fails it
  (verified: TS2322 in `apps/shell/src/App.tsx`).
- The host still depends on remotes in the package graph, so in the monorepo every remote change marks the shell as
  affected (iteration 13); in a polyrepo only a version bump does.
- Each expose is declared twice (webpack `exposes` + package `exports`) and must be kept in sync by hand.
- Types still describe the repo/published version, not the deployed one; until iteration 12 (contract testing) and
  iteration 09 (error boundaries) a deploy-time mismatch shows up only as a runtime bug.
- No new dependencies.
