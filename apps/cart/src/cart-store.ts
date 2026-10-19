import { MF_EVENTS, subscribeToMfEvent } from '@mf/contracts';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartLine {
  productId: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  isMiniCartOpen: boolean;
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  setMiniCartOpen: (isOpen: boolean) => void;
}

function addOneOf(lines: CartLine[], productId: string): CartLine[] {
  const existing = lines.find((line) => line.productId === productId);
  if (!existing) return [...lines, { productId, quantity: 1 }];
  return lines.map((line) => (line === existing ? { ...line, quantity: line.quantity + 1 } : line));
}

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return typeof line.productId === 'string' && Number.isInteger(line.quantity);
}

// localStorage is untrusted input (edited by hand, written by an older build): keep only well-formed lines.
function mergePersistedLines(persisted: unknown, current: CartState): CartState {
  const lines = (persisted as { lines?: unknown } | undefined)?.lines;
  return Array.isArray(lines) ? { ...current, lines: lines.filter(isCartLine) } : current;
}

// One instance per page because the module is evaluated once inside the single `cart` container.
// Other apps reach it only through the `./store` expose (ADR 0009).
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isMiniCartOpen: false,
      addItem: (productId) =>
        set((state) => ({ lines: addOneOf(state.lines, productId), isMiniCartOpen: true })),
      removeItem: (productId) =>
        set((state) => ({ lines: state.lines.filter((line) => line.productId !== productId) })),
      clear: () => set({ lines: [] }),
      setMiniCartOpen: (isOpen) => set({ isMiniCartOpen: isOpen }),
    }),
    {
      name: 'cart:items',
      version: 1,
      partialize: (state) => ({ lines: state.lines }),
      merge: mergePersistedLines,
    },
  ),
);

// Cart lines belong to the user who added them: when the session ends (in any tab), the cart owner resets its
// own state. Module level, because the store lives as long as the cart container, not as long as a component.
subscribeToMfEvent(MF_EVENTS.loggedOut, () => {
  useCartStore.getState().clear();
  useCartStore.getState().setMiniCartOpen(false);
});

export function selectItemCount(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}
