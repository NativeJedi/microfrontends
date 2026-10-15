import { ROUTES } from '@mf/contracts';
import { lazy, Suspense } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router';
import { useRecentlyViewedProduct } from './use-recently-viewed-product';

const CatalogApp = lazy(() => import('catalog/App'));
const CartApp = lazy(() => import('cart/App'));
const AccountApp = lazy(() => import('account/App'));
const CartWidget = lazy(() => import('cart/CartWidget'));

function RecentlyViewedLink() {
  const product = useRecentlyViewedProduct();
  if (!product) return null;

  return (
    <Link to={ROUTES.catalog.product(product.productId)}>Recently viewed: {product.name}</Link>
  );
}

function Header() {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <h1 style={{ marginRight: 'auto' }}>Marketplace shell</h1>
      <NavLink to={ROUTES.catalog.root}>Catalog</NavLink>
      <NavLink to={ROUTES.account.root}>Account</NavLink>
      <RecentlyViewedLink />
      <Suspense fallback={<span>Cart…</span>}>
        <CartWidget label="Cart" />
      </Suspense>
    </header>
  );
}

function NotFoundPage() {
  return <h2>Page not found</h2>;
}

// The shell owns the URL: it mounts each remote under its prefix with a splat ("/*"),
// and the remote matches the rest of the path with its own relative <Routes>.
export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <Header />
      <main>
        <Suspense fallback={<p>Loading…</p>}>
          <Routes>
            <Route path={ROUTES.home} element={<Navigate to={ROUTES.catalog.root} replace />} />
            <Route path={`${ROUTES.catalog.root}/*`} element={<CatalogApp />} />
            <Route path={`${ROUTES.cart}/*`} element={<CartApp />} />
            <Route path={`${ROUTES.account.root}/*`} element={<AccountApp />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
