// Plain functions, no module-level state: bundled into every app that imports them.
// The stateful client of iteration 08 (token, single-flight refresh) is created by the shell from a factory here
// and passed to remotes through props, so it stays one instance per page (ADR 0010).
export { getProduct, getProducts } from './products';
export type { Product } from './products';
export { createOrder, getOrders } from './orders';
export type { CreateOrderRequest, Order, OrderItem } from './orders';
