# 0012 — i18n: shell-owned i18next instance, remote-owned namespaces loaded through a loader backend

- Status: accepted
- Date: 2026-10-17
- Iteration: 07

## Context
Every app has UI texts, and the page must show one language. i18next keeps the current language and all loaded
translations in one instance; react-i18next reads that instance from React context. If each app creates or initializes
the instance itself, the last `init` wins and wipes the others' translations. Translations must also stay owned by the
app that renders them and be deployable with it, so the shell cannot bundle or even know the remotes' texts. They must
be loaded lazily (only for apps the user actually opens) and from the remote's own origin, not from the host's.

## Options
1. **Every app inits the shared default `i18next` instance** — no wiring; the last `init` resets the language and the
   resource store of all apps (confirmed: the shell's `uk` bundle disappears, keys are rendered).
2. **Shell instance; each remote loads its JSON itself and calls `addResourceBundle`, React Suspense waits for it** —
   no i18next backend; but react-i18next 17 subscribes through `useSyncExternalStore`, whose updates cannot run inside
   `startTransition`, so on a language switch every remote whose bundle is not loaded yet shows its Suspense fallback
   ("Loading…") for a moment (confirmed in the browser).
3. **Shell instance + one i18next backend that delegates to loaders registered by each app (chosen)** — i18next's own
   lifecycle: `changeLanguage()` loads the new language of every namespace used so far and only then emits
   `languageChanged`; all apps switch in one render. Needs a small cross-bundle registration API.
4. **Shell backend calls a new `./i18n` expose of every remote** — native loading as in 3; but the shell must list every
   remote's namespace and each remote gets one more contract to keep in sync.
5. **`i18next-http-backend` with a `loadPath` per namespace** — standard plugin; the shell must know every remote's
   origin and file layout (`http://localhost:3001/locales/{{lng}}.json`), files are not content-hashed by webpack, and a
   new dependency.
6. **Bundle all translations eagerly** — simplest; downloads every language of every app up front and couples releases.

## Decision
Option 3.
- `i18next` and `react-i18next` are MF singletons (SPEC section 7). The shell's `bootstrap.tsx` creates the only
  instance with `createI18n()` from `@mf/i18n` (`i18next.createInstance()`, not the default export) and provides it
  with `<I18nextProvider>`, like the `QueryClient`. A remote creates its own instance only in its standalone
  `bootstrap.tsx`; `exposed/` code never calls `createI18n` or `init`.
- The instance's backend (`createNamespaceLoaderBackend`) knows no URLs. Each app registers a loader for its namespace
  (`shell`, `catalog`, `cart`, `account` — the container name) through `useNamespaceTranslation(namespace, loader)`;
  the loader is a dynamic `import()` of `src/i18n/locales/<lng>.json`, so the bundle is a chunk of the owning app and
  loads from its `publicPath: 'auto'`.
- The registration API is found on `instance.modules.backend` by shape (`registerNamespace` method), not by class:
  every app bundles its own copy of `@mf/i18n`, so `instanceof` would fail across bundles.
- The shell owns the language: `<select>` in the header, persisted as `shell:language`, `<html lang>` updated.
  `fallbackLng: false`: a fallback language would download a second bundle per namespace.
- Formatting uses the built-in i18next formatters, which are `Intl` (`{{value, currency(USD)}}`,
  `{{value, datetime}}`); plurals use `Intl.PluralRules` (`_one/_few/_many/_other`).

## Consequences
- A remote adds or changes texts without touching the shell; a new remote needs no i18n change in the shell.
- One request per app per language, only for apps that rendered translated text; a language switch also reloads
  namespaces of apps visited earlier and not on screen now (they are in `options.ns`).
- Namespace names are a cross-app contract (one namespace per app, named after the container); a remote that reuses
  another app's namespace overwrites its loader.
- Missing keys render as the key (no fallback language, no typed keys yet). Typed keys via i18next
  `CustomTypeOptions` and API content in the user's language (`Accept-Language`) are left for later.
- Locale chunks are named `locale-<lng>.js` without a content hash, like all chunks today (caching — iteration 11).
