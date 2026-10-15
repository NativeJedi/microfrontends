# 02 — Types for remotes

> Challenge: #4

## Problem
A host imports remote modules by a name that exists only at runtime (`catalog/ProductList` is resolved by Module
Federation (MF) from `remoteEntry.js`). TypeScript has no package to read types from, so teams add an ambient
`declare module 'catalog/*'` stub — and from then on nothing checks the boundary. A remote team renames a prop,
both apps typecheck and build, and the host breaks in production, often silently.

## Solution
- catalog exports the props type next to its exposed component (type = named export, component = default export):
  ```tsx
  // apps/catalog/src/exposed/ProductList.tsx
  export interface ProductListProps {
    title: string;
  }
  export default function ProductList({ title }: ProductListProps) { … }
  ```
- shell maps every remote prefix to the remote's exposed sources:
  ```jsonc
  // apps/shell/tsconfig.json
  "compilerOptions": {
    "paths": {
      "catalog/*": ["../catalog/src/exposed/*"],
      "cart/*": ["../cart/src/exposed/*"]
    }
  }
  ```
- shell declares the remotes as workspace dev dependencies: `"catalog": "workspace:*"`, `"cart": "workspace:*"`
  (needed for Turborepo caching, see problem 2).
- `apps/shell/src/remotes.d.ts` (the stub) is deleted; `<ProductList title="Catalog" />` is now type-checked.
- Decision and alternatives: [ADR 0006](../decisions/0006-remote-types.md).

Verified: renaming `title` → `heading` in catalog fails `pnpm typecheck` in the shell (without `--force`);
adding an optional prop passes; the shell bundle contains no catalog code; all three apps render as before.

## How it works

### Two resolvers read the same string
`import('catalog/ProductList')` is read twice, by two tools that do not know about each other:

| Who | When | How `catalog/ProductList` is resolved |
|---|---|---|
| webpack | build + runtime | `remotes: { catalog: 'catalog@http://localhost:3001/remoteEntry.js' }` → a remote module; at runtime `container.get('./ProductList')` |
| TypeScript | typecheck / IDE | `compilerOptions.paths` → `apps/catalog/src/exposed/ProductList.tsx` |

`paths` only affects how `tsc` finds files: it emits nothing and webpack never reads it. Patterns are resolved
relative to the `tsconfig.json` that declares them (no `baseUrl` needed). The `*` is substituted, so
`catalog/ProductList` → `../catalog/src/exposed/ProductList` → `.tsx` found by `moduleResolution: "Bundler"`.
`tsc` then type-checks that file (and everything it imports) as part of the shell's program, so
`lazy(() => import('catalog/ProductList'))` gets the real component type including its props.

### Why types cannot come "from the remote" at runtime
Types are erased during compilation; `remoteEntry.js` and its chunks are plain JavaScript. Type checking happens
before the app runs, so the types must be on disk when `tsc` runs. The only choice is **which copy** of the remote's
types the host checks against: the remote's source in the repo (our choice), emitted declarations, a contracts
package, or declarations downloaded from the deployed remote.

### Why the package name does not break the bundle
The shell now has `node_modules/catalog` (a symlink to `apps/catalog`). webpack still loads catalog through MF:
`ContainerReferencePlugin` hooks into module creation and turns any request starting with a remote name
(`catalog/…`) into a remote module **before** normal resolution would look at `node_modules`.
Checked: no catalog code (e.g. `Mechanical keyboard`) in `apps/shell/dist`.

### Importing only a type from a remote
If the host needs just the type, use a type-only import statement:
```ts
import type { ProductListProps } from 'catalog/ProductList';
```
It is always erased. A value import (`import ProductList from 'catalog/ProductList'`) at module top level would make
the remote a static dependency of that chunk: the remote is fetched before the chunk can run, instead of lazily.

## What can go wrong

### 1. Ambient stub + a changed prop in the remote
Scenario: shell has `declare module 'catalog/*' { const c: ComponentType; export default c; }`; catalog renames the
required prop `title` → `heading`.
- **Symptom:** `pnpm typecheck` and `pnpm build` pass in every app. At runtime nothing throws: the shell still passes
  `title`, catalog reads `heading` = `undefined`, React renders an empty `<h2>`. A prop that is used as an object or
  array instead (e.g. `items.map`) crashes with `TypeError: Cannot read properties of undefined (reading 'map')`.
  The stub also pushes towards `any`: with `ComponentType` (props `{}`) the shell cannot pass `title` at all, so the
  stub tends to become `ComponentType<any>`.
- **Root cause:** the stub is a promise to the compiler that is never checked against the real module. The real
  types of catalog are not part of the shell's TypeScript program.
- **Fix:** give `tsc` the real types — `paths` to the remote's source (chosen), emitted `.d.ts`, a contracts package,
  or types downloaded from the deployed remote (see trade-offs). With our fix the same rename fails in the shell:
  ```
  src/App.tsx(15,26): error TS2322: Type '{ title: string; }' is not assignable to type 'IntrinsicAttributes & ProductListProps'.
    Property 'title' does not exist on type 'IntrinsicAttributes & ProductListProps'.
  ```
  A removed required prop that the host does not pass gives
  `error TS2741: Property 'title' is missing in type '{}' but required in type 'ProductListProps'.`

### 2. Turborepo replays a cached success
Scenario: `paths` is set up, but the shell has no package dependency on catalog. Change only catalog, run `pnpm typecheck`.
- **Symptom:** `shell#typecheck` shows `cache hit, replaying logs` and the run is green, although `tsc` in the shell
  would fail. Running `tsc` directly in `apps/shell` (or `turbo --force`) shows the error.
- **Root cause:** a task hash includes the package's own files, its dependencies' task hashes and the config — not files
  that `tsconfig` reaches through `paths`. Turborepo cannot know that the shell's typecheck reads catalog's sources.
- **Fix:** make the dependency explicit — `"catalog": "workspace:*"` in the shell's `devDependencies`. Then
  `dependsOn: ["^typecheck"]` adds `catalog#typecheck` to the shell's task graph (`turbo run typecheck --dry=json`:
  `shell#typecheck deps: cart#typecheck,catalog#typecheck`), and a change in catalog changes the shell's hash.
  Alternatives: `inputs` with `$TURBO_ROOT$/apps/catalog/src/**` in the shell's turbo config (hidden coupling),
  or `--force` (no cache at all).

### 3. Build-time vs deploy-time drift
Scenario: catalog and shell are deployed independently. The shell was type-checked against catalog's code in `main`,
but production runs an older (or newer) catalog.
- **Symptom:** same as problem 1 — runtime break with green CI, only now the types were "correct".
- **Root cause:** the types describe the remote's code at the moment the host was checked; the remote that is loaded
  is whatever is deployed at the moment the user opens the page.
- **Fix:** keep exposed modules backward compatible (additive changes only, breaking change = new expose name),
  validate at the boundary at runtime, check the deployed exposes — iteration 04. Types fetched from the deployed
  remote (dts-plugin) narrow the window but do not close it: the remote can be redeployed after the host's build.

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| Ambient stub `declare module 'catalog/*'` | zero setup | no checking, drifts towards `any` |
| **`paths` → remote source (chosen)** | no build step, instant IDE feedback, go-to-definition into the remote | monorepo only; the host checks the remote's internals too; needs an explicit workspace dependency for caching |
| `paths` / project references → emitted `.d.ts` | host sees only declarations; looks like a published artifact | task ordering, stale `dist` risk |
| Types / contracts package (iter 04) | explicit contract, works in a polyrepo via npm | contract and implementation must be kept in sync |
| Types downloaded from the deployed remote (`@module-federation/dts-plugin`, iter 17) | polyrepo; matches the deployed version | typecheck depends on network and remote availability; more CI setup |
| Runtime validation (zod, iter 04) | catches drift after independent deploys | runtime cost; complements types, does not replace them |

## Interview questions
- **Q:** Why can't the host get a remote's types at runtime, like it gets its code?
  **A:** Types are erased at compile time; `remoteEntry.js` is JS. Type checking happens before runtime, so types must
  be available to `tsc` at build time — from source, declarations, a package or a download step.
- **Q:** How would you type remotes in a monorepo vs a polyrepo?
  **A:** Monorepo: `paths` to the remote's source or emitted declarations, plus an explicit workspace dependency so the
  task runner orders and invalidates correctly. Polyrepo: publish a contracts/types package or download declarations
  from the deployed remote (dts-plugin) during the host's build.
- **Q:** Your types are correct and CI is green, but the host breaks after a remote deploy. Why?
  **A:** Build-time vs deploy-time drift: the host was checked against one version of the remote and runs against
  another. Types cannot fix it; backward-compatible exposes, versioned expose names and runtime validation can.
- **Q:** Does `paths` change what webpack bundles?
  **A:** No. It only tells `tsc` where to find files. webpack resolves `catalog/*` through MF remotes.

## Links
- TypeScript: [`paths`](https://www.typescriptlang.org/tsconfig/#paths), [`moduleResolution: bundler`](https://www.typescriptlang.org/tsconfig/#moduleResolution)
- webpack: [Module Federation](https://webpack.js.org/concepts/module-federation/)
- Turborepo: [Caching — task inputs and hashing](https://turborepo.com/docs/crafting-your-repository/caching)
- Module Federation: [Type hinting / dts-plugin](https://module-federation.io/guide/basic/type-prompt.html)
