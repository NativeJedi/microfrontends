import { selectItemCount, useCartStore } from '../cart-store';
import MiniCart from '../mini-cart/MiniCart';
import styles from './CartWidget.module.css';

export interface CartWidgetProps {
  label: string;
}

// Header counter and mini-cart for the shell: rendered inside the shell's router and QueryClient.
export default function CartWidget({ label }: CartWidgetProps) {
  const itemCount = useCartStore(selectItemCount);
  const isMiniCartOpen = useCartStore((state) => state.isMiniCartOpen);
  const setMiniCartOpen = useCartStore((state) => state.setMiniCartOpen);

  return (
    <div className={styles.widget}>
      <button
        type="button"
        className={styles.toggle}
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
