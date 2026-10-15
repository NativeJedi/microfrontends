import { orderQueries, ROUTES, type Order } from '@mf/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

function OrderRow({ order }: { order: Order }) {
  return (
    <li>
      {order.id}:{' '}
      {order.items.map((item, index) => (
        <span key={item.productId}>
          {index > 0 && ', '}
          <Link to={ROUTES.catalog.product(item.productId)}>{item.name}</Link> × {item.quantity}
        </span>
      ))}{' '}
      — ${order.total}
    </li>
  );
}

// Cart invalidates the orders key after checkout, so a new order shows up here without a reload.
export default function OrdersPage() {
  const { data: orders, isPending, error } = useQuery(orderQueries.list());

  return (
    <section>
      <h3>Orders</h3>
      {isPending && <p>Loading…</p>}
      {error && <p>Could not load orders: {error.message}</p>}
      <ul>
        {orders?.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ul>
    </section>
  );
}
