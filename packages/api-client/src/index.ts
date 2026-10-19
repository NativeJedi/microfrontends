// Plain functions and factories, no module-level state: bundled into every app that imports them.
// The stateful instances (session, API client) are created once by the shell's bootstrap and reach remotes
// through the @mf/services container, so they stay one instance per page.
export { createSession } from './session';
export type { Session } from './session';
export { createApiClient, HttpError } from './http';
export type { ApiClient, Credentials } from './http';
export { DEV_CREDENTIALS } from './dev-credentials';
export { API_CLIENT_SERVICE, SESSION_SERVICE } from './service-keys';
export { getProduct, getProducts } from './products';
export type { Product } from './products';
export { createOrder, getOrders } from './orders';
export type { CreateOrderRequest, Order, OrderItem } from './orders';
