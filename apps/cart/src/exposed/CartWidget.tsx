import { selectItemCount, useCartStore } from '../cart-store';
import MiniCart from '../mini-cart/MiniCart';

export interface CartWidgetProps {
  label: string;
}

// Header counter and mini-cart for the shell: rendered inside the shell's router and QueryClient.
export default function CartWidget({ label }: CartWidgetProps) {
  const itemCount = useCartStore(selectItemCount);
  const isMiniCartOpen = useCartStore((state) => state.isMiniCartOpen);
  const setMiniCartOpen = useCartStore((state) => state.setMiniCartOpen);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-expanded={isMiniCartOpen}
        aria-controls="mini-cart"
        onClick={() => setMiniCartOpen(!isMiniCartOpen)}
      >
        {label} ({itemCount})
      </button>
      {isMiniCartOpen && <MiniCart id="mini-cart" />}
    </div>
  );
}
