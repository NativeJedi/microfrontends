import type { Credentials } from './http';

// Dev only: the demo user seeded in services/api/src/auth/users.ts, used by the standalone dev login of
// remotes and as a hint on the shell's login page. Not a secret: the API is an in-memory demo.
export const DEV_CREDENTIALS: Credentials = {
  email: 'buyer@example.com',
  password: 'demo-password',
};
