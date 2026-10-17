import { ROUTES } from '@mf/contracts';
import { Navigate, NavLink, Route, Routes } from 'react-router';
import { useAccountTranslation } from '../i18n/use-account-translation';
import OrdersPage from '../pages/OrdersPage';
import ProfilePage from '../pages/ProfilePage';
import styles from './App.module.css';

// Route definitions are relative to the host's mount point (/account/*). Links use ROUTES:
// inside a splat route a relative link resolves against the whole URL
// (/account/profile + "orders" → /account/profile/orders).
export default function App() {
  const t = useAccountTranslation();

  return (
    <section>
      <h2>{t('title')}</h2>
      <nav className={styles.nav}>
        <NavLink to={ROUTES.account.profile}>{t('nav.profile')}</NavLink>
        <NavLink to={ROUTES.account.orders}>{t('nav.orders')}</NavLink>
      </nav>
      <Routes>
        <Route index element={<Navigate to={ROUTES.account.profile} replace />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="orders" element={<OrdersPage />} />
      </Routes>
    </section>
  );
}
