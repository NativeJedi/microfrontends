import { ROUTES } from '@mf/contracts';
import { Link, useParams } from 'react-router';
import { findProductById } from '../products';

export default function ProductDetailsPage() {
  const { productId = '' } = useParams();
  const product = findProductById(productId);

  if (!product) {
    return (
      <section>
        <h2>Product not found</h2>
        <Link to={ROUTES.catalog.root}>Back to catalog</Link>
      </section>
    );
  }

  return (
    <section>
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <p>${product.price}</p>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link to={ROUTES.catalog.root}>Back to catalog</Link>
        <Link to={ROUTES.cart}>Go to cart</Link>
      </nav>
    </section>
  );
}
