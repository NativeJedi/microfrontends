import { Route, Routes } from 'react-router';
import OrderDetails from '../orders/OrderDetails';
import OrdersList from '../orders/OrdersList';

/**
 * The second face of this widget: the same code that fills a card on the dashboard grid also runs as a
 * whole application under `/dashboard/orders`. Two exposes, one deployment.
 *
 * These are *descendant* routes, two levels down: the shell matched `/dashboard/*`, the dashboard matched
 * `:widgetId/*`, and what reaches here is only what is left. The widget never learns its mount point —
 * its links come from the shell's route map in `@mf/contracts`, not from string literals.
 *
 * Unlike `./Widget`, this expose *requires* a router in the host. That is the contract: a card is a
 * component, an application is a router level.
 */
export default function App() {
  return (
    <Routes>
      <Route index element={<OrdersList />} />
      <Route path=":orderId" element={<OrderDetails />} />
    </Routes>
  );
}
