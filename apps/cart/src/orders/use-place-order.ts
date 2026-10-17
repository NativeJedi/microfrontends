import { createOrder } from '@mf/api-client';
import { orderKeys } from '@mf/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../cart-store';

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
