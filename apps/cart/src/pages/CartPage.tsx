import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { useCartStore } from '../cart-store';
import { usePlaceOrder } from '../orders/use-place-order';
import { useCartProducts } from '../products/use-cart-products';

function PlacedOrderMessage({ orderId }: { orderId: string }) {
  return (
    <p>
      Order {orderId} placed. <Link to={ROUTES.account.orders}>View orders</Link>
    </p>
  );
}

export default function CartPage() {
  const lines = useCartStore((state) => state.lines);
  const removeItem = useCartStore((state) => state.removeItem);
  const { productLines, error } = useCartProducts(lines);
  const placeOrder = usePlaceOrder();

  return (
    <section>
      <h2>Cart</h2>
      {placeOrder.data && <PlacedOrderMessage orderId={placeOrder.data.id} />}
      {lines.length === 0 && <p>Cart is empty</p>}
      {error && <p>Could not load products: {error.message}</p>}
      <ul>
        {productLines.map(({ productId, quantity, product }) => (
          <li key={productId}>
            <Link to={ROUTES.catalog.product(productId)}>{product?.name ?? productId}</Link> ×{' '}
            {quantity} {product && `— $${product.price * quantity}`}{' '}
            <button type="button" onClick={() => removeItem(productId)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
      {lines.length > 0 && (
        <button
          type="button"
          disabled={placeOrder.isPending}
          onClick={() => placeOrder.mutate({ items: lines })}
        >
          {placeOrder.isPending ? 'Placing order…' : 'Place order'}
        </button>
      )}
      {placeOrder.error && <p>Could not place the order: {placeOrder.error.message}</p>}
      <p>
        <Link to={ROUTES.catalog.root}>Continue shopping</Link>
      </p>
    </section>
  );
}
