import { ROUTES } from '@mf/contracts';
import { Link } from 'react-router';
import { products } from '../products';

export default function ProductListPage() {
  return (
    <section>
      <h2>Catalog</h2>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <Link to={ROUTES.catalog.product(product.id)}>{product.name}</Link> — ${product.price}
          </li>
        ))}
      </ul>
    </section>
  );
}
