import { addToCart, useCartQuantity } from 'cart/store';
import { useCatalogTranslation } from '../i18n/use-catalog-translation';
import styles from './AddToCartButton.module.css';

// Cart state is owned by the cart remote; catalog only uses its public `cart/store` API.
export default function AddToCartButton({ productId }: { productId: string }) {
  const t = useCatalogTranslation();
  const quantityInCart = useCartQuantity(productId);

  return (
    <button type="button" className={styles.button} onClick={() => addToCart(productId)}>
      {quantityInCart > 0 ? t('addToCartWithQuantity', { count: quantityInCart }) : t('addToCart')}
    </button>
  );
}
