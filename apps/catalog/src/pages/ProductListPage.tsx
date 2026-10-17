import { ROUTES } from '@mf/contracts';
import { productQueries } from '@mf/queries';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import AddToCartButton from '../add-to-cart/AddToCartButton';
import { useCatalogTranslation } from '../i18n/use-catalog-translation';

export default function ProductListPage() {
  const t = useCatalogTranslation();
  const { data: products, isPending, error } = useQuery(productQueries.list());

  return (
    <section>
      <h2>{t('title')}</h2>
      {isPending && <p>{t('loading')}</p>}
      {error && <p>{t('loadError', { message: error.message })}</p>}
      <ul>
        {products?.map((product) => (
          <li key={product.id}>
            <Link to={ROUTES.catalog.product(product.id)}>{product.name}</Link> —{' '}
            {t('price', { value: product.price })} <AddToCartButton productId={product.id} />
          </li>
        ))}
      </ul>
    </section>
  );
}
