import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { cartItems, getTotalQuantity } from '../cart-items';

export interface CartWidgetProps {
  label: string;
}

// Mini-cart for the shell header: rendered inside the shell's router, so <Link> works.
export default function CartWidget({ label }: CartWidgetProps) {
  return (
    <Link to={ROUTES.cart}>
      {label} ({getTotalQuantity(cartItems)})
    </Link>
  );
}
