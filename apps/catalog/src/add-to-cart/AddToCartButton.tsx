import { addToCart, useCartQuantity } from 'cart/store';

// Cart state is owned by the cart remote; catalog only uses its public `cart/store` API.
export default function AddToCartButton({ productId }: { productId: string }) {
  const quantityInCart = useCartQuantity(productId);

  return (
    <button type="button" onClick={() => addToCart(productId)}>
      Add to cart{quantityInCart > 0 && ` (${quantityInCart} in cart)`}
    </button>
  );
}
