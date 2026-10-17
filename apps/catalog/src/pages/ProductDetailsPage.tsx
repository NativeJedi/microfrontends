import { dispatchMfEvent, MF_EVENTS, ROUTES } from '@mf/contracts';
import { productQueries } from '@mf/queries';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import AddToCartButton from '../add-to-cart/AddToCartButton';
import { useCatalogTranslation } from '../i18n/use-catalog-translation';
import styles from './ProductDetailsPage.module.css';

export default function ProductDetailsPage() {
  const t = useCatalogTranslation();
  const { productId = '' } = useParams();
  const { data: product, isPending, error } = useQuery(productQueries.detail(productId));

  useEffect(() => {
    if (product)
      dispatchMfEvent(MF_EVENTS.productViewed, { productId: product.id, name: product.name });
  }, [product]);

  if (isPending) return <p>{t('loading')}</p>;

  if (error) {
    return (
      <section>
        <h2>{t('productNotFound')}</h2>
        <Link to={ROUTES.catalog.root}>{t('backToCatalog')}</Link>
      </section>
    );
  }

  return (
    <section>
      <h2>{product.name}</h2>
      <p>{product.description}</p>
      <p>{t('price', { value: product.price })}</p>
      <AddToCartButton productId={product.id} />
      <nav className={styles.nav}>
        <Link to={ROUTES.catalog.root}>{t('backToCatalog')}</Link>
        <Link to={ROUTES.cart}>{t('goToCart')}</Link>
      </nav>
    </section>
  );
}
