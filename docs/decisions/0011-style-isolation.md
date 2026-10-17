# 0011 — Style isolation: CSS Modules with app-prefixed names, tokens as CSS custom properties, stylelint for remotes

- Status: accepted
- Date: 2026-10-17
- Iteration: 06

## Context
All micro-frontends render into one document, so every stylesheet a remote loads applies to the whole page. Two teams
that both write `.button`, or one team that ships a reset (`* { margin: 0 }`, `button { … }`), restyle each other, and
the winner is whichever chunk loaded last — that depends on the route the user opened first. Stylesheets are also never
removed when a remote unmounts. On top of that the shell needs one theme (light/dark) that all remotes follow without a
JS contract per remote.

## Options
1. **Naming convention (BEM with an app prefix, `.cart-button`)** — zero tooling; relies on discipline, nothing stops a
   remote from writing `button {}` or a reset.
2. **CSS Modules, `localIdentName` with a literal app prefix** — class names are generated per file and app
   (`cart__button__NUfhj`); zero runtime; standard webpack loaders; global selectors are still possible
   (`:global`, type selectors) and need a lint rule.
3. **CSS-in-JS (styled-components, Emotion)** — scoped by construction; runtime cost, and the library must be an MF
   singleton or every remote ships its own copy with its own style sheet manager and class-name counter
   (collisions between counters, duplicated runtime).
4. **Shadow DOM per remote** — real isolation both ways; React portals (modals, tooltips) render outside the shadow root
   and lose styles, `@font-face` must be declared in the document, events are retargeted to the host element, global
   tokens reach inside only through inherited custom properties, and third-party UI kits that inject into
   `document.head` break.
5. **iframes** — total isolation; separate document, routing, focus, sizing and shared state all become cross-frame
   messaging.

## Decision
Option 2 with three rules:
- `css-loader` `modules.localIdentName: '<app>__[local]__[hash:base64:5]'` in every `webpack.config.js`. The literal
  prefix matters: the default hash is computed from the file path relative to the project, so
  `src/pages/Button.module.css` in two apps would get the **same** class name.
- Shared look goes through `@mf/tokens`: CSS custom properties on `:root`, dark values on `:root[data-theme='dark']`.
  The shell loads the tokens and the only reset, and owns the theme (`<html data-theme>`, persisted as `shell:theme`).
  Remotes read `var(--mf-…, <fallback>)` and never define tokens; they import `tokens.css` only in the standalone
  `bootstrap.tsx`.
- `stylelint` (root `stylelint.config.js`) forbids global CSS in remotes: type, universal and id selectors, `:global`,
  `:root`, `@font-face`, `@import` in `*.module.css`, and any selector in a plain `.css` file. Runs in `pnpm lint`.

Dev uses `style-loader` (`<style>` tags, fast reloads); production uses `MiniCssExtractPlugin` (`.css` chunks loaded
with `<link>` from each remote's own origin through `publicPath: 'auto'`). Shadow DOM is documented, not built.

## Consequences
- The load order of remote CSS no longer matters; leftover styles of unmounted remotes are harmless because they match
  only that remote's classes.
- Theme switching needs no JS contract: changing one attribute on `<html>` re-resolves every `var()` on the page.
- Token names (`--mf-*`) become a cross-app contract like query keys: renaming one is a breaking change; the fallbacks
  keep a remote readable when an old shell does not define a new token.
- Remotes duplicate fallback values; CSS is not minified in production (no `css-minimizer-webpack-plugin` yet,
  iteration 11).
- A component library shared across remotes would need its own decision (shared MF singleton vs bundled copy).
