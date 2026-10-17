import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { useCartStore } from '../cart-store';
import { useCartTranslation } from '../i18n/use-cart-translation';
import { useCartProducts } from '../products/use-cart-products';
import styles from './MiniCart.module.css';

interface MiniCartProps {
  id: string;
}

export default function MiniCart({ id }: MiniCartProps) {
  const t = useCartTranslation();
  const lines = useCartStore((state) => state.lines);
  const setMiniCartOpen = useCartStore((state) => state.setMiniCartOpen);
  const { productLines, isPending } = useCartProducts(lines);

  return (
    <div id={id} className={styles.miniCart}>
      {lines.length === 0 && <p>{t('empty')}</p>}
      {isPending && lines.length > 0 && <p>{t('loading')}</p>}
      <ul>
        {productLines.map(({ productId, quantity, product }) => (
          <li key={productId}>
            {product?.name ?? productId} × {quantity}
          </li>
        ))}
      </ul>
      <Link to={ROUTES.cart} onClick={() => setMiniCartOpen(false)}>
        {t('goToCart')}
      </Link>
    </div>
  );
}
