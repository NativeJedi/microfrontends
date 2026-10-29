import { ROUTES } from '@mf/contracts';
import { RemoteSlot } from '@mf/runtime';
import { Suspense } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router';
import styles from './App.module.css';
import LanguageSwitcher from './i18n/LanguageSwitcher';
import { useShellTranslation } from './i18n/use-shell-translation';
import CartSlot from './remotes/CartSlot';
import RemoteFallback from './remotes/RemoteFallback';
import type { AccountAppProps, CartAppProps, CatalogAppProps } from './remotes/remote-props';
import AuthControls from './session/AuthControls';
import LoginPage from './session/LoginPage';
import RequireAuth from './session/RequireAuth';
import { useSessionCleanup } from './session/use-session-cleanup';
import ThemeToggle from './theme/ThemeToggle';
import { useRecentlyViewedProduct } from './use-recently-viewed-product';

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
      <RecentlyViewedLink />
      <CartSlot />
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
//
// Since iteration 09 each remote sits in its own <RemoteSlot>: an error boundary plus a Suspense
// boundary around a module loaded by hand from the runtime registry. One remote being down is a
// hole in the page, never a blank page — and the shell's own header keeps working either way.
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
            <Route
              path={`${ROUTES.catalog.root}/*`}
              element={
                <RemoteSlot<CatalogAppProps>
                  remote="catalog"
                  module="./App"
                  pending={<p>{t('loading')}</p>}
                  fallback={(state) => <RemoteFallback name={t('nav.catalog')} {...state} />}
                />
              }
            />
            <Route
              path={`${ROUTES.cart}/*`}
              element={
                <RemoteSlot<CartAppProps>
                  remote="cart"
                  module="./App"
                  pending={<p>{t('loading')}</p>}
                  fallback={(state) => <RemoteFallback name={t('nav.cart')} {...state} />}
                />
              }
            />
            <Route
              path={`${ROUTES.account.root}/*`}
              element={
                <RequireAuth>
                  <RemoteSlot<AccountAppProps>
                    remote="account"
                    module="./App"
                    pending={<p>{t('loading')}</p>}
                    fallback={(state) => <RemoteFallback name={t('nav.account')} {...state} />}
                  />
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
