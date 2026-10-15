export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
}

export const products: Product[] = [
  { id: 'p1', name: 'Mechanical keyboard', price: 89, description: 'Tactile switches, USB-C.' },
  { id: 'p2', name: 'USB-C hub', price: 39, description: 'HDMI, 3× USB-A, SD card reader.' },
  { id: 'p3', name: 'Standing desk mat', price: 54, description: 'Anti-fatigue foam, 90×50 cm.' },
];

export function findProductById(productId: string): Product | undefined {
  return products.find((product) => product.id === productId);
}
