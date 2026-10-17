import { useCartStore } from '../cart-store';

// Public API of the cart state for other micro-frontends. The store itself and its shape stay private,
// so cart can change them without a contract change.
export function addToCart(productId: string): void {
  useCartStore.getState().addItem(productId);
}

export function useCartQuantity(productId: string): number {
  return useCartStore(
    (state) => state.lines.find((line) => line.productId === productId)?.quantity ?? 0,
  );
}
