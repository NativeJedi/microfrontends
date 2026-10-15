import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { cartItems, getTotalQuantity } from '../cart-items';

// Mini-cart for the shell header: rendered inside the shell's router, so <Link> works.
export default function CartWidget() {
  return <Link to={ROUTES.cart}>Cart ({getTotalQuantity(cartItems)})</Link>;
}
