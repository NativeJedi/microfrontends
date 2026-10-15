import { productQueries, ROUTES } from '@mf/contracts';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import AddToCartButton from '../add-to-cart/AddToCartButton';

export default function ProductListPage() {
  const { data: products, isPending, error } = useQuery(productQueries.list());

  return (
    <section>
      <h2>Catalog</h2>
      {isPending && <p>Loading…</p>}
      {error && <p>Could not load products: {error.message}</p>}
      <ul>
        {products?.map((product) => (
          <li key={product.id}>
            <Link to={ROUTES.catalog.product(product.id)}>{product.name}</Link> — ${product.price}{' '}
            <AddToCartButton productId={product.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
