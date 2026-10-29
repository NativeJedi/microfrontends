import type AccountApp from 'account/App';
import type CartApp from 'cart/App';
import type CartWidget from 'cart/CartWidget';
import type CatalogApp from 'catalog/App';

// loadRemote() takes two strings, so nothing in the shell's own code would notice if a remote
// renamed an expose or changed its props. These type-only imports keep the compile-time contract
// of iteration 04 alive: the remotes stay devDependencies for their types, while their URLs come
// from the runtime registry. `import type` is erased, so webpack never sees these specifiers.
/**
 * Props of an exposed component. A component declared without a props parameter — which is how
 * the propless `./App` exposes come out of their declaration files — infers `unknown`; normalize
 * that to "no props" so a slot for one needs no props at all.
 */
type PropsOf<T> = T extends (props: infer P) => unknown
  ? P extends object
    ? P
    : Record<string, never>
  : Record<string, never>;

export type CatalogAppProps = PropsOf<typeof CatalogApp>;
export type CartAppProps = PropsOf<typeof CartApp>;
export type AccountAppProps = PropsOf<typeof AccountApp>;
export type CartWidgetProps = PropsOf<typeof CartWidget>;
