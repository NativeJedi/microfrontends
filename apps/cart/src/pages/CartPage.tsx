import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { useCartStore } from '../cart-store';
import { useCartTranslation } from '../i18n/use-cart-translation';
import { usePlaceOrder } from '../orders/use-place-order';
import { useCartProducts } from '../products/use-cart-products';
import { useIsLoggedIn } from '../session/use-is-logged-in';
import styles from './CartPage.module.css';

function PlacedOrderMessage({ orderId }: { orderId: string }) {
  const t = useCartTranslation();

  return (
    <p>
      {t('orderPlaced', { orderId })} <Link to={ROUTES.account.orders}>{t('viewOrders')}</Link>
    </p>
  );
}

export default function CartPage() {
  const t = useCartTranslation();
  const lines = useCartStore((state) => state.lines);
  const removeItem = useCartStore((state) => state.removeItem);
  const { productLines, error } = useCartProducts(lines);
  const placeOrder = usePlaceOrder();
  const isLoggedIn = useIsLoggedIn();

  return (
    <section>
      <h2>{t('title')}</h2>
      {placeOrder.data && <PlacedOrderMessage orderId={placeOrder.data.id} />}
      {lines.length === 0 && <p>{t('empty')}</p>}
      {error && <p>{t('loadError', { message: error.message })}</p>}
      <ul>
        {productLines.map(({ productId, quantity, product }) => (
          <li key={productId}>
            <Link to={ROUTES.catalog.product(productId)}>{product?.name ?? productId}</Link> ×{' '}
            {quantity} {product && t('lineTotal', { value: product.price * quantity })}{' '}
            <button type="button" className={styles.button} onClick={() => removeItem(productId)}>
              {t('remove')}
            </button>
          </li>
        ))}
      </ul>
      {lines.length > 0 && isLoggedIn && (
        <button
          type="button"
          className={styles.button}
          disabled={placeOrder.isPending}
          onClick={() => placeOrder.mutate({ items: lines })}
        >
          {placeOrder.isPending ? t('placingOrder') : t('placeOrder')}
        </button>
      )}
      {/* The login page belongs to the shell; returnTo brings the user back to the cart. */}
      {lines.length > 0 && !isLoggedIn && (
        <Link to={ROUTES.login(ROUTES.cart)}>{t('logInToPlaceOrder')}</Link>
      )}
      {placeOrder.error && <p>{t('placeOrderError', { message: placeOrder.error.message })}</p>}
      <p>
        <Link to={ROUTES.catalog.root}>{t('continueShopping')}</Link>
      </p>
    </section>
  );
}
