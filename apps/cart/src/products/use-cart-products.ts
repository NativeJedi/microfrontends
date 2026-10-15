import { productQueries, type Product } from '@mf/contracts';
import { useQuery } from '@tanstack/react-query';
import type { CartLine } from '../cart-store';

export interface CartProductLine extends CartLine {
  product: Product | undefined;
}

// Reads the product list through the shared cache: when catalog already loaded it, no request is made.
export function useCartProducts(lines: CartLine[]) {
  const productsQuery = useQuery(productQueries.list());
  const productLines: CartProductLine[] = lines.map((line) => ({
    ...line,
    product: productsQuery.data?.find((product) => product.id === line.productId),
  }));

  return { productLines, isPending: productsQuery.isPending, error: productsQuery.error };
}
