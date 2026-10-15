export interface CartItem {
  id: string;
  name: string;
  quantity: number;
}

// Static mock until the shared store in iteration 05.
export const cartItems: CartItem[] = [
  { id: 'p1', name: 'Mechanical keyboard', quantity: 1 },
  { id: 'p2', name: 'USB-C hub', quantity: 2 },
];

export function getTotalQuantity(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
