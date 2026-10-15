// Custom DOM events between micro-frontends. Names are `<owner-app>:<kebab-name>`; the owner is the producer.
// A breaking payload change ships under a new name (`catalog:product-viewed.v2`), see SPEC section 6.
export const MF_EVENTS = {
  productViewed: 'catalog:product-viewed',
} as const;

export interface ProductViewedPayload {
  productId: string;
  name: string;
}

export interface MfEventPayloads {
  [MF_EVENTS.productViewed]: ProductViewedPayload;
}

export type MfEventName = keyof MfEventPayloads;

export function dispatchMfEvent<Name extends MfEventName>(
  name: Name,
  payload: MfEventPayloads[Name],
): void {
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}

// Returns an unsubscribe function, so it can be returned from useEffect directly.
export function subscribeToMfEvent<Name extends MfEventName>(
  name: Name,
  handler: (payload: MfEventPayloads[Name]) => void,
): () => void {
  // Trusted like any typed import: payloads between our own apps are not validated at runtime (SPEC section 6).
  const listener = (event: Event) => handler((event as CustomEvent<MfEventPayloads[Name]>).detail);

  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}
