// Query keys are a cross-app contract: every app reads and invalidates the one shared cache through them,
// so renaming a key is a breaking change (SPEC section 6). Key, fetcher, response type and staleTime travel
// together in queryOptions, so two apps cannot store different shapes under one key.
export { productKeys, productQueries } from './products';
export { orderKeys, orderQueries } from './orders';
