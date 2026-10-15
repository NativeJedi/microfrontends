# 0006 — Types for remote modules

- Status: accepted
- Date: 2026-10-15
- Iteration: 02

## Context
The shell imports remote modules (`import('catalog/ProductList')`) that webpack resolves at runtime
through Module Federation (MF). TypeScript knows nothing about MF: there is no `catalog` package with
types, so iteration 00 used an ambient stub (`declare module 'catalog/*'` → `ComponentType`). With the
stub a breaking change in a remote's props passes `pnpm typecheck` and fails only at runtime.
Types are erased at compile time and `remoteEntry.js` is plain JavaScript, so types can never be
"downloaded from the remote at runtime" — they must be available to `tsc` at build time.

## Options
1. **Ambient stub** (status quo) — zero setup; no checking at all, pushes towards `any`.
2. **`paths` → remote source** — host `tsconfig.json` maps `catalog/*` to `../catalog/src/exposed/*`;
   no build step, the IDE sees changes immediately. Monorepo only; the host's `tsc` also checks the remote's
   internal code imported by its exposed modules.
3. **`paths` / project references → emitted `.d.ts`** — the remote runs `tsc --emitDeclarationOnly`; the host
   reads only declarations. Isolates internals; adds task ordering and a stale-`dist` risk.
4. **Types / contracts package** — props types live in a shared package (workspace or npm). Explicit contract,
   works in a polyrepo; implementation and contract must be kept in sync. Planned for iteration 04.
5. **Types fetched from the deployed remote** — the remote packs declarations of its exposes, the host downloads
   them by URL (`@module-federation/dts-plugin` or a custom script). Matches the *deployed* version and works in a
   polyrepo; typecheck depends on network and remote availability. Shown in iteration 16.
6. **Runtime validation** (zod) at the boundary — catches drift after independent deploys; complements types,
   does not replace them. Iteration 04.

## Decision
Option 2. The shell maps every remote prefix to the remote's `src/exposed/*` and declares each remote as a
`devDependencies` entry (`"catalog": "workspace:*"`).

The workspace dependency is required for correctness, not for resolution: Turborepo hashes only a package's own
files, so without it a change in catalog alone replays the cached *successful* `shell#typecheck`. With it,
`dependsOn: ["^typecheck"]` makes `shell#typecheck` depend on `catalog#typecheck`, whose hash covers catalog's source.

The package name equals the MF container name. That is safe: `ContainerReferencePlugin` turns `catalog/...` requests
into remote modules before normal module resolution, so the `node_modules/catalog` symlink never ends up in the bundle
(verified: no catalog code in `apps/shell/dist`).

## Consequences
- A removed/renamed required prop fails `pnpm typecheck` in the shell; additive optional props do not.
- Types are checked against the remote's code **in the repo**, not against what is deployed (build-time vs
  deploy-time drift) — addressed by contracts and runtime validation in iteration 04.
- `pnpm build` of the shell now waits for the remotes' builds (`^build`); `pnpm dev --filter shell...` also starts
  catalog and cart. In iteration 12 "affected apps" will treat the shell as affected by every remote change —
  revisit when types move to `packages/contracts`.
- An internal type error in a remote module reachable from its exposes also fails the shell's typecheck.
