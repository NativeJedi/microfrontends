# 06 — Style isolation

> Challenge: #6

## Problem
Micro-frontends share one DOM (Document Object Model) and one CSS cascade. A stylesheet loaded by any remote applies to
the whole page, so two teams that both write `.button`, or one team that ships a global reset, restyle each other. The
result depends on which chunk loaded last — i.e. on the route the user opened first — and stylesheets are never
removed when a remote unmounts. The shell also has to switch the theme for apps it does not build.

## Solution
- **CSS Modules everywhere**, class names prefixed with the app (every `webpack.config.js`):
  ```js
  {
    test: /\.module\.css$/,
    use: [
      styleLoader, // 'style-loader' in dev, MiniCssExtractPlugin.loader in production
      {
        loader: 'css-loader',
        options: {
          modules: { localIdentName: 'cart__[local]__[hash:base64:5]', namedExport: false },
        },
      },
    ],
  },
  ```
  catalog's `AddToCartButton.module.css` and cart's `CartPage.module.css` both define `.button`; on the page they are
  `catalog__button__Fz_bY` and `cart__button__NUfhj`. All inline `style={{…}}` objects were replaced by modules.
  Types: `src/css.d.ts` in every app (`declare module '*.module.css'`), included in remotes' `tsconfig.types.json`.
- **`@mf/tokens`** (`packages/tokens/src/tokens.css`): `--mf-color-*`, `--mf-space-1..4`, `--mf-radius`,
  `--mf-font-*` on `:root`, dark values on `:root[data-theme='dark']`. Remotes read them with fallbacks:
  ```css
  .button {
    background: var(--mf-color-accent, #2563eb);
    border-radius: var(--mf-radius, 6px);
  }
  ```
- **Shell owns global CSS and the theme.** `bootstrap.tsx` imports `@mf/tokens/tokens.css` and `./global.css` (the only
  reset). `theme/use-theme.ts` sets `document.documentElement.dataset.theme` and persists `shell:theme` (narrowed on
  read); `ThemeToggle` sits in the header. Remotes import `tokens.css` only in their standalone `bootstrap.tsx`.
- **stylelint** (`stylelint.config.js`, in `pnpm lint` of every app): in `apps/{catalog,cart,account}` a
  `*.module.css` may not use type, universal or id selectors, `:global`, `:root`, `@font-face`, `@import`; a plain
  `.css` file in a remote may not contain any selector.
- **Production:** `MiniCssExtractPlugin` emits `.css` chunks next to the JS chunks of each expose.

## How it works
- **CSS Modules** — `css-loader` rewrites every local class name to `localIdentName` and exports the mapping
  (`{ button: 'cart__button__NUfhj' }`); the component uses `className={styles.button}`. Nothing global is left to
  collide, so CSS order stops mattering. The hash is computed from the file path relative to the app root and the
  local name; without the literal app prefix `src/Button.module.css` in two apps would produce identical names.
- **Dev (`style-loader`)** — the CSS is a JS module; evaluating it appends a `<style>` tag. Remote CSS arrives inside
  the remote's JS chunks, so it is injected when the shell first loads that expose.
- **Production (`MiniCssExtractPlugin`)** — CSS is moved to `.css` files; webpack adds a `miniCss` handler to the
  chunk-loading runtime of each container. When the shell calls `cart.get('./App')`, cart's runtime loads chunk 858's
  JS **and** `<link href="http://localhost:3002/858.css">`. The URL comes from cart's `__webpack_public_path__`, which
  `publicPath: 'auto'` computed from the `remoteEntry.js` script URL — the same mechanism as for JS chunks. Each
  runtime de-duplicates `<link>` tags by the full URL, so catalog's, cart's and account's `858.css` (same chunk id,
  different origins) coexist. Verified on the production build: `/384.css` (shell), `:3001/858.css`, `:3002/945.css`
  (CartWidget), `:3002/858.css`, `:3003/858.css`.
- **Theme** — custom properties inherit and are resolved at computed-value time. Changing `data-theme` on `<html>`
  swaps the values, and every `var(--mf-…)` on the page, in any remote, re-resolves. No props, events or context cross
  the MF boundary; the contract is the token names.

## What can go wrong

### 1. catalog adds a global reset and `.button`, cart has its own `.button`
- **Symptom:** no error. Buttons look different depending on navigation order: open `/catalog` first, then `/cart` →
  cart's `.button` rules (loaded later) win for both apps' buttons where properties overlap; open `/cart` first, then
  `/catalog` → catalog's rules win. catalog's `button { … }` / `* { margin: 0 }` reset also restyles the shell header
  and cart. Equal specificity → the later stylesheet in document order wins, and document order = chunk load order.
- **Root cause:** global selectors in a shared document; MF loads CSS lazily per expose, so the order is decided at
  runtime by the user's route, not at build time.
- **Fix:** (chosen) CSS Modules with an app prefix — no shared class names exist; the reset moves to the shell, which
  owns the layout; stylelint fails `pnpm lint` on any global selector in a remote. Alternatives: BEM with app prefix
  (discipline only), raising specificity / `!important` (an arms race), CSS-in-JS, Shadow DOM.

### 2. Styles of an unmounted remote stay in `<head>`
- **Symptom:** go `/catalog` → `/cart`: `<head>` still contains catalog's `<style>` tags in dev
  (`catalog__button__Fz_bY`, `catalog__nav___BB27`) or `<link href="http://localhost:3001/858.css">` in production.
  Confirmed in the browser for both modes.
- **Root cause:** neither `style-loader` nor the `MiniCssExtractPlugin` runtime removes CSS: a loaded module/chunk stays
  in the module cache for the lifetime of the page, and React unmounting a component does not unload its module.
  With global selectors, a remote that is no longer visible keeps restyling the page.
- **Fix:** (chosen) make leftovers harmless — scoped class names match only that remote's elements, which are gone.
  Alternatives: `style-loader` `injectType: 'lazyStyleTag'` with `styles.use()` / `styles.unuse()` in mount/unmount
  effects (manual reference counting, dev/prod behave differently, no equivalent for extracted CSS); Shadow DOM
  (styles live and die with the shadow root).

## Trade-offs and alternatives
| Option | Pros | Cons |
|---|---|---|
| CSS Modules + app prefix (chosen) | Zero runtime; standard loaders; works with SSR (iter 16) | Global selectors still possible → needs stylelint |
| BEM / naming convention | No tooling | Discipline only; resets still leak |
| CSS-in-JS (styled-components, Emotion) | Scoped by construction, dynamic styles | Runtime cost; must be an MF singleton or every remote ships its own runtime and class counter (duplicate styles, name collisions) |
| Shadow DOM | True isolation both directions | Portals render outside the root and lose styles; `@font-face` only works in the document; events retargeted to the host; UI kits injecting into `document.head` break |
| iframe | Total isolation | Separate document: routing, focus, sizing, shared state via `postMessage` |
| `lazyStyleTag` (use/unuse) | Removes CSS on unmount | Manual ref counting; dev only, nothing equivalent for extracted CSS |

## Interview questions
- **Q:** Two remotes both define `.button`. Which one wins?
  **A:** With global CSS — the one whose stylesheet was inserted later (same specificity), i.e. the remote loaded
  later, which depends on the user's route. With CSS Modules the classes are different (`catalog__button__…`,
  `cart__button__…`), so nobody wins and nobody loses.
- **Q:** Why prefix `localIdentName` with the app name if CSS Modules already hash?
  **A:** The default hash comes from the relative file path and local name. Two apps with the same structure
  (`src/components/Button.module.css`, `.button`) produce the same name on one page.
- **Q:** How does the CSS of a remote get loaded in production?
  **A:** `MiniCssExtractPlugin` adds a CSS handler to the remote container's chunk loader. Loading an expose loads its
  JS chunks and `<link>`s the matching `.css` chunks from the remote's public path (`publicPath: 'auto'` → origin of
  `remoteEntry.js`).
- **Q:** How does the shell switch the theme in remotes it does not build?
  **A:** Tokens are CSS custom properties; the shell flips `data-theme` on `<html>`, all `var()` references re-resolve.
  The contract is the variable names; remotes use fallbacks so an older shell without a new token still works.
- **Q:** Why is CSS-in-JS risky in micro-frontends?
  **A:** Each remote bundles its own runtime unless the library is an MF singleton: duplicated code, several style
  managers inserting into `<head>`, and class-name counters that can collide across copies.
- **Q:** When would you pick Shadow DOM?
  **A:** Embedding third-party or legacy UI whose CSS you cannot control. Costs: portals, fonts, event retargeting,
  UI kits that write to `document.head`.

## Links
- css-loader `modules` options: https://webpack.js.org/loaders/css-loader/#modules
- style-loader `injectType`: https://webpack.js.org/loaders/style-loader/#injecttype
- mini-css-extract-plugin: https://webpack.js.org/plugins/mini-css-extract-plugin/
- stylelint rules: https://stylelint.io/user-guide/rules
- CSS custom properties: https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties
