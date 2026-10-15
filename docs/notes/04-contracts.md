# 04 — Contracts between micro-frontends

> Challenge: #3

## Problem
With independent deploys the host runs against whatever version of a remote is deployed right now, not the version
it was type-checked against. A remote team renames a prop, every app typechecks and builds, and the host breaks in
production — often silently (`undefined` rendered instead of a crash). Micro-frontends also talk through events; a
payload change on one side is invisible to the other side's compiler. A contract is the agreement that lets each side
change without a coordinated release: who owns it, how it travels, how it may change, and how violations show up.

## Solution
- **Props types are owned by the remote and published as its artifact.** Each remote emits declarations of its exposes
  and maps them in `package.json` `exports`:
  ```jsonc
  // apps/cart/package.json
  "exports": {
    "./App": { "types": "./types/exposed/App.d.ts" },
    "./CartWidget": { "types": "./types/exposed/CartWidget.d.ts" }
  },
  "scripts": { "types": "rm -rf types && tsc -p tsconfig.types.json" }
  ```
  `tsconfig.types.json` extends the app config with `emitDeclarationOnly`, `rootDir: "src"`, `outDir: "types"`,
  `include: ["src/exposed"]`. `types/` is gitignored.
- **Shell has no `paths` any more.** `import('cart/CartWidget')` resolves through the `cart` workspace package
  (`"cart": "workspace:*"` in shell `devDependencies` is now the real type delivery channel, not a cache workaround).
  `turbo.json`: `typecheck.dependsOn: ["^typecheck", "^types"]`; `build` no longer waits for `^build`.
- **`@mf/contracts` keeps only cross-app pieces:** `ROUTES` and custom events.
  ```ts
  // packages/contracts/src/events.ts
  export const MF_EVENTS = { productViewed: 'catalog:product-viewed' } as const;
  export interface ProductViewedPayload { productId: string; name: string }
  dispatchMfEvent(MF_EVENTS.productViewed, { productId, name });       // catalog, product page
  useEffect(() => subscribeToMfEvent(MF_EVENTS.productViewed, setProduct), []); // shell header
  ```
  The shell header shows "Recently viewed: <name>" linking to `ROUTES.catalog.product(id)`.
- `cart/CartWidget` takes a required `label` prop (`CartWidgetProps`), so the header shows a typed boundary in action.
- **Compatibility rules** (SPEC section 6): additive changes only; a breaking change ships under a new expose name and
  the old one is kept until no deployed host uses it. No demo of a V2 expose: it is ordinary API versioning, nothing
  specific to Module Federation.
- **No runtime validation between our own apps** (a dev-only zod guard was built and then removed — see
  "Why no runtime validation").
- Rules: SPEC section 6 "Contracts between micro-frontends". Decision: [ADR 0008](../decisions/0008-contracts-between-micro-frontends.md).

Verified: header "Cart (3)", `/catalog/p2` → "Recently viewed: USB-C hub" and the link works, standalone
remotes render, clean console; renaming `label` in cart's `CartWidgetProps` fails shell typecheck (TS2322, without
`--force`); `turbo run typecheck --dry=json` → `shell#typecheck` depends on `cart#types`; no remote code in shell's production
`dist`.

## How it works

### One string, two resolvers (again)
| Who | Reads `cart/CartWidget` as |
|---|---|
| webpack | a remote module (`remotes.cart`) → at runtime `container.get('./CartWidget')` |
| TypeScript | a package subpath: `node_modules/cart/package.json` → `exports["./CartWidget"].types` → `types/exposed/CartWidget.d.ts` |

With `moduleResolution: "Bundler"`, `exports` is authoritative: a subpath that is not listed is not resolvable even if
the file exists. So `exports` is the remote's explicit public type surface, and the emitted `.d.ts` contains only
signatures — the host no longer type-checks remote internals:
```ts
export interface CartWidgetProps { label: string; }
export default function CartWidget({ label }: CartWidgetProps): import("react").JSX.Element;
```

### Why no runtime validation
A dev-only zod guard (props checked in the remote, payloads in the listener) was implemented and removed. Who catches
what between our own apps:

| Risk | Caught by |
|---|---|
| Breaking signature in the repo | typecheck through the remote's emitted `.d.ts` |
| Breaking module deployed / rolled back | contract testing with `can-i-deploy` (iteration 12) |
| A remote fails at runtime anyway | error boundary + fallback (iteration 09) |
| Local version mismatch in development | dev guard — only a clearer message than `undefined (3)` |

A dev-only guard covers only the last row and prevents nothing; an always-on one adds bundle size and still lets the
bad deploy happen. Runtime validation belongs at **untrusted** boundaries: API responses, cross-origin `postMessage`,
third-party widgets, `localStorage`. Typed modules of our own teams are trusted like any import.

If you do add a dev-only check, keep it out of production with a dynamic `import()` placed **inside**
`if (process.env.NODE_ENV !== 'production')`: webpack removes code by constant-folding that condition, so an `import()`
elsewhere (a helper never called in production, a loader lambda passed as an argument) can still emit its chunk.

## What can go wrong

### 1. A remote renames a prop and is deployed independently (ROADMAP problem)
Scenario: cart changes `CartWidget`'s `label` to `title` in place; the deployed shell still passes `label`
(simulated with a cast in the shell during the iteration, then reverted).
- **Symptom:** no exception, nothing in the console. The header renders `undefined (3)`. The same for an event payload
  sent as `{ id, name }`: the "Recently viewed" link points to `/catalog/undefined`.
- **Root cause:** each app was type-checked against a consistent snapshot, but the two deployed versions are from
  different snapshots. Types are erased; nothing checks the props at the MF boundary at runtime.
- **Fix:** do not make breaking changes in place: additive only, breaking → new expose name kept next to the old one;
  contract testing (iteration 12) blocks the deploy that would break it. Inside one repo the emitted types catch it:
  renaming `label` → `title` in cart fails the shell
  (`src/App.tsx(28,21): error TS2322: Type '{ label: string; }' is not assignable to type 'IntrinsicAttributes & CartWidgetProps'.`).

### 2. The host is newer than the deployed remote (late deploy or rollback)
Scenario: shell already uses a new expose; the running cart is a version without it. Observed for real during this
iteration (with a temporary `./CartWidgetV2`): the dev servers had been started before it was added to cart's webpack `exposes`
(webpack config is read only at start).
- **Symptom:** the whole shell renders nothing:
  ```
  Uncaught Error: Module "./CartWidgetV2" does not exist in container.
  while loading "./CartWidgetV2" from webpack/container/reference/cart
  ```
- **Root cause:** `container.get()` of a module the deployed container does not have rejects; with no error boundary the
  failure propagates to the root.
- **Fix:** deploy order (provider first, then consumers) and keep old exposes during the compatibility window; block a
  deploy **or rollback** of the provider when a deployed consumer needs something it does not have — consumer-driven
  contract testing with `can-i-deploy` (iteration 12). A check in the host's CI cannot do it: a provider rollback does
  not run the host's pipeline. Runtime containment (error boundary + fallback per remote) — iteration 09.

### 3. An event is dispatched before the listener subscribes
Scenario: the producer fires during its first render/effect, but the consumer mounts later (or is lazy-loaded after it).
- **Symptom:** nothing happens, no error. Here it works only because the shell header subscribes before the catalog
  remote is even loaded.
- **Root cause:** DOM events are fire-and-forget; there is no buffer or replay.
- **Fix:** subscribe in the long-lived owner (shell); for state that late subscribers need, use shared state instead of
  events (iteration 05) or a "last value" replay in the event helper.

### 4. Types artifact out of sync with `exports`
Scenario: a remote adds an expose to webpack `exposes` but forgets `exports`, or removes an expose and an old `.d.ts`
stays in `types/`.
- **Symptom:** missing entry → `src/App.tsx(9,38): error TS2307: Cannot find module 'cart/CartWidget' or its corresponding type declarations.`
  A stale file is harmless only because resolution goes through `exports`.
- **Root cause:** each expose is declared twice (runtime `exposes`, type `exports`); `tsc` never deletes old output.
- **Fix:** `rm -rf types` before emitting; review both lists together (SPEC rule); a generated list is possible but
  would hide config (explicit over magic).

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| **Remote publishes emitted `.d.ts` via `exports` (chosen)** | types live with the implementation; same flow as a polyrepo; host sees only public signatures | contract is implicit — every signature change is published; two lists to keep in sync |
| Central contracts package with typed `declare module` | explicit, reviewed contract; host fully decoupled | every change touches a second package; in a polyrepo a separate repo/release |
| `paths` to remote source (ADR 0006) | zero build step | monorepo only; host checks remote internals |
| Types downloaded from the deployed remote (dts-plugin, iter 17) | matches the deployed version | network at typecheck time, more tooling |
| Hand-written `container.get` check script | finds missing exposes on running remotes | runs only in the consumer's CI, misses provider rollbacks; reinvents contract testing |
| Contract testing with a broker (iter 12) | gates every deploy and rollback | broker, test suites on both sides |

**Polyrepo:** cart's CI publishes a scoped types package (`@mf/cart`) on every release; shell has
`"@mf/cart": "^2.3.0"` in `devDependencies`, and Renovate/Dependabot bump PRs run shell's typecheck against the new
types. Because the package name differs from the MF specifier, the package ships an ambient shim
`declare module 'cart/CartWidget' { export { default } from '@mf/cart/CartWidget'; }`. Use a scope: an unscoped name
in a private registry is open to dependency confusion.

## Interview questions
- **Q:** What is a contract between micro-frontends?
  **A:** Everything one deploy relies on from another: exposed module names, their props, events and payloads, routes,
  shared singletons. It needs an owner, a delivery channel for types, change rules and runtime/deploy-time checks.
- **Q:** How do you change an exposed component's props without a coordinated release?
  **A:** Additive changes only; a breaking change goes to a new expose (`./XV2`), the old one stays as an adapter marked
  `@deprecated`; hosts migrate at their own pace; the old expose is removed when no deployed host uses it.
- **Q:** Types are green but production broke after a remote deploy. Why, and what helps?
  **A:** Build-time vs deploy-time drift: the host was checked against another version. Backward-compatible exposes,
  error boundaries, and contract testing with `can-i-deploy` before every deploy.
- **Q:** How do remote types reach the host in a polyrepo?
  **A:** The remote's CI publishes declarations as a scoped package (or the host downloads them from the deployed remote
  with dts-plugin); the host pins and bumps the version like any dependency.
- **Q:** What is consumer-driven contract testing and why can't a check in the host's CI replace it?
  **A:** Consumers publish what they use, providers verify against it, and a broker knows what is deployed where, so any
  deploy — including a provider rollback — can be checked. The host's CI does not run when the provider changes.
- **Q:** Should a remote validate the props it receives at runtime?
  **A:** Not between your own typed, contract-tested apps: it prevents nothing, only improves a local error message, and
  costs bundle size if always on. Validate untrusted inputs — API responses, cross-origin messages, third-party code.
- **Q:** How do you keep dev-only code out of production bundles?
  **A:** Put a dynamic `import()` inside an `if (process.env.NODE_ENV !== 'production')` branch; the bundler removes the
  branch and never emits the chunk.

## Links
- TypeScript: [package.json `exports` and `types` conditions](https://www.typescriptlang.org/docs/handbook/modules/reference.html#packagejson-exports), [`emitDeclarationOnly`](https://www.typescriptlang.org/tsconfig/#emitDeclarationOnly)
- webpack: [Module Federation](https://webpack.js.org/concepts/module-federation/), [`mode` and `process.env.NODE_ENV`](https://webpack.js.org/configuration/mode/)
- Pact: [Event-driven systems](https://docs.pact.io/implementation_guides/javascript/docs/messages), [can-i-deploy](https://docs.pact.io/pact_broker/can_i_deploy)
- [BlackRock — micro-frontends and contract testing](https://engineering.blackrock.com/unravelling-the-micro-frontends-puzzle-with-contract-testing-68c4cbe93a9f)
