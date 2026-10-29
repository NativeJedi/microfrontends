// Custom DOM events between micro-frontends. Names are `<owner-app>:<kebab-name>`; the owner is the producer.
// A breaking payload change ships under a new name (`catalog:product-viewed.v2`), see SPEC section 6.
export const MF_EVENTS = {
  productViewed: 'catalog:product-viewed',
  // The session ended in this tab (logout, failed refresh, or logout in another tab).
  // Every app that keeps user-specific client state resets it.
  loggedOut: 'shell:logged-out',
} as const;

export interface ProductViewedPayload {
  productId: string;
  name: string;
}

// No data: "who" and "why" are not needed to reset state. Optional fields may be added later (additive change).
export type LoggedOutPayload = Record<string, never>;

export interface MfEventPayloads {
  [MF_EVENTS.productViewed]: ProductViewedPayload;
  [MF_EVENTS.loggedOut]: LoggedOutPayload;
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
