import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { cartItems } from '../cart-items';

export default function CartPage() {
  return (
    <section>
      <h2>Cart</h2>
      <ul>
        {cartItems.map((item) => (
          <li key={item.id}>
            <Link to={ROUTES.catalog.product(item.id)}>{item.name}</Link> × {item.quantity}
          </li>
        ))}
      </ul>
      <Link to={ROUTES.catalog.root}>Continue shopping</Link>
    </section>
  );
}
