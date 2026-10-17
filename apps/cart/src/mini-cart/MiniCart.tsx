import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { useCartStore } from '../cart-store';
import { useCartProducts } from '../products/use-cart-products';
import styles from './MiniCart.module.css';

interface MiniCartProps {
  id: string;
}

export default function MiniCart({ id }: MiniCartProps) {
  const lines = useCartStore((state) => state.lines);
  const setMiniCartOpen = useCartStore((state) => state.setMiniCartOpen);
  const { productLines, isPending } = useCartProducts(lines);

  return (
    <div id={id} className={styles.miniCart}>
      {lines.length === 0 && <p>Cart is empty</p>}
      {isPending && lines.length > 0 && <p>Loading…</p>}
      <ul>
        {productLines.map(({ productId, quantity, product }) => (
          <li key={productId}>
            {product?.name ?? productId} × {quantity}
          </li>
        ))}
      </ul>
      <Link to={ROUTES.cart} onClick={() => setMiniCartOpen(false)}>
        Go to cart
      </Link>
    </div>
  );
}
