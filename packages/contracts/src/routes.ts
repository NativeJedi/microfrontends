// Absolute URLs owned by the shell. Every link and redirect uses these constants, never string
// literals. Remotes declare their <Routes> relative to the mount point (see docs/notes/03-routing.md).
export const ROUTES = {
  home: '/',
  // returnTo: where to go after a successful login. The shell accepts only same-app paths (no open redirect).
  login: (returnTo?: string) =>
    returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login',
  catalog: {
    root: '/catalog',
    product: (productId: string) => `/catalog/${encodeURIComponent(productId)}`,
  },
  cart: '/cart',
  dashboard: '/dashboard',
  account: {
    root: '/account',
    profile: '/account/profile',
    orders: '/account/orders',
  },
} as const;
