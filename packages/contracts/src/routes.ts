// Absolute URLs owned by the shell. Every link and redirect uses these constants, never string
// literals. Remotes declare their <Routes> relative to the mount point (see docs/notes/03-routing.md).
export const ROUTES = {
  home: '/',
  catalog: {
    root: '/catalog',
    product: (productId: string) => `/catalog/${encodeURIComponent(productId)}`,
  },
  cart: '/cart',
  account: {
    root: '/account',
    profile: '/account/profile',
    orders: '/account/orders',
  },
} as const;
