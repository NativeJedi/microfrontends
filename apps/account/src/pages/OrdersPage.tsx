import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';

interface Order {
  id: string;
  productId: string;
  productName: string;
  total: number;
}

// Static mock until the API in iteration 05.
const orders: Order[] = [
  { id: 'o-1001', productId: 'p3', productName: 'Standing desk mat', total: 54 },
  { id: 'o-1002', productId: 'p1', productName: 'Mechanical keyboard', total: 89 },
];

export default function OrdersPage() {
  return (
    <section>
      <h3>Orders</h3>
      <ul>
        {orders.map((order) => (
          <li key={order.id}>
            {order.id}:{' '}
            <Link to={ROUTES.catalog.product(order.productId)}>{order.productName}</Link> — $
            {order.total}
          </li>
        ))}
      </ul>
    </section>
  );
}
