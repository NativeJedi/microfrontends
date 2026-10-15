import { lazy, Suspense } from 'react';

const ProductList = lazy(() => import('catalog/ProductList'));
const CartWidget = lazy(() => import('cart/CartWidget'));

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <header>
        <h1>Marketplace shell</h1>
      </header>
      <main style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 2 }}>
          <Suspense fallback={<p>Loading catalog…</p>}>
            <ProductList title="Catalog" />
          </Suspense>
        </div>
        <div style={{ flex: 1 }}>
          <Suspense fallback={<p>Loading cart…</p>}>
            <CartWidget />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
