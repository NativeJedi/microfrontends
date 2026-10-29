import { ROUTES } from '@mf/contracts';
import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router';
import styles from './App.module.css';
import LanguageSwitcher from './i18n/LanguageSwitcher';
import AuthControls from './session/AuthControls';
import LoginPage from './session/LoginPage';
import RequireAuth from './session/RequireAuth';
import { useSessionCleanup } from './session/use-session-cleanup';
import { useShellTranslation } from './i18n/use-shell-translation';
import ThemeToggle from './theme/ThemeToggle';
import { useRecentlyViewedProduct } from './use-recently-viewed-product';

const CatalogApp = lazy(() => import('catalog/App'));
const CartApp = lazy(() => import('cart/App'));
const AccountApp = lazy(() => import('account/App'));
const DashboardApp = lazy(() => import('dashboard/App'));
const CartWidget = lazy(() => import('cart/CartWidget'));

function RecentlyViewedLink() {
  const t = useShellTranslation();
  const product = useRecentlyViewedProduct();
  if (!product) return null;

  return (
    <Link to={ROUTES.catalog.product(product.productId)}>
      {t('recentlyViewed', { name: product.name })}
    </Link>
  );
}

function Header() {
  const t = useShellTranslation();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{t('title')}</h1>
      <NavLink to={ROUTES.catalog.root}>{t('nav.catalog')}</NavLink>
      <NavLink to={ROUTES.account.root}>{t('nav.account')}</NavLink>
      <NavLink to={ROUTES.dashboard}>{t('nav.dashboard')}</NavLink>
      <RecentlyViewedLink />
      <Suspense fallback={<span>{t('cartLoading')}</span>}>
        {/* The label is the shell's text, so the shell translates it; the prop contract is unchanged. */}
        <CartWidget label={t('nav.cart')} />
      </Suspense>
      <AuthControls />
      <LanguageSwitcher />
      <ThemeToggle />
    </header>
  );
}

function NotFoundPage() {
  const t = useShellTranslation();
  return <h2>{t('notFound')}</h2>;
}

// The shell owns the URL: it mounts each remote under its prefix with a splat ("/*"),
// and the remote matches the rest of the path with its own relative <Routes>.
export default function App() {
  const t = useShellTranslation();
  useSessionCleanup();

  return (
    <div className={styles.layout}>
      <Header />
      <main>
        <Suspense fallback={<p>{t('loading')}</p>}>
          <Routes>
            <Route path={ROUTES.home} element={<Navigate to={ROUTES.catalog.root} replace />} />
            <Route path={`${ROUTES.catalog.root}/*`} element={<CatalogApp />} />
            <Route path={`${ROUTES.cart}/*`} element={<CartApp />} />
            <Route
              path={`${ROUTES.account.root}/*`}
              element={
                <RequireAuth>
                  <AccountApp />
                </RequireAuth>
              }
            />
            <Route
              path={ROUTES.dashboard}
              element={
                <RequireAuth>
                  <DashboardApp />
                </RequireAuth>
              }
            />
            <Route path={ROUTES.login()} element={<LoginPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
