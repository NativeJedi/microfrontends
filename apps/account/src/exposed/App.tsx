import { ROUTES } from '@mf/contracts';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import OrdersPage from '../pages/OrdersPage';
import ProfilePage from '../pages/ProfilePage';
import styles from './App.module.css';

// Route definitions are relative to the host's mount point (/account/*). Links use ROUTES:
// inside a splat route a relative link resolves against the whole URL
// (/account/profile + "orders" → /account/profile/orders).
export default function App() {
  return (
    <section>
      <h2>Account</h2>
      <nav className={styles.nav}>
        <NavLink to={ROUTES.account.profile}>Profile</NavLink>
        <NavLink to={ROUTES.account.orders}>Orders</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to={ROUTES.account.profile} replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="orders" element={<OrdersPage />} />
      </Routes>
    </section>
  );
}
