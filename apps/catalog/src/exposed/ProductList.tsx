interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [
  { id: 'p1', name: 'Mechanical keyboard', price: 89 },
  { id: 'p2', name: 'USB-C hub', price: 39 },
  { id: 'p3', name: 'Standing desk mat', price: 54 },
];

export default function ProductList() {
  return (
    <section style={{ border: '1px solid #ccc', padding: 16 }}>
      <h2>Catalog</h2>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            {product.name} — ${product.price}
          </li>
        ))}
      </ul>
    </section>
  );
}
