interface CartItem {
  id: string;
  name: string;
  quantity: number;
}

const items: CartItem[] = [
  { id: 'p1', name: 'Mechanical keyboard', quantity: 1 },
  { id: 'p2', name: 'USB-C hub', quantity: 2 },
];

export default function CartWidget() {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section style={{ border: '1px solid #ccc', padding: 16 }}>
      <h2>Cart ({totalQuantity})</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} × {item.quantity}
          </li>
        ))}
      </ul>
    </section>
  );
}
