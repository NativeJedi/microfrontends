import { fetchJson, orderKeys, type Order } from '@mf/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore, type CartLine } from '../cart-store';

function createOrder(lines: CartLine[]): Promise<Order> {
  return fetchJson<Order>('/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: lines }),
  });
}

// Cart writes orders, account reads them: invalidating the shared key makes account refetch
// the next time its query is mounted, instead of showing a cached list for the rest of staleTime.
export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const clearCart = useCartStore((state) => state.clear);

  return useMutation({
    mutationFn: createOrder,
    onSuccess: async () => {
      clearCart();
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });
}
