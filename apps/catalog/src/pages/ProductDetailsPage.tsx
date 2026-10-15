import { dispatchMfEvent, MF_EVENTS, ROUTES } from '@mf/contracts';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { findProductById } from '../products';

export default function ProductDetailsPage() {
  const { productId = '' } = useParams();
  const product = findProductById(productId);

  useEffect(() => {
    if (product)
      dispatchMfEvent(MF_EVENTS.productViewed, { productId: product.id, name: product.name });
  }, [product]);

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
