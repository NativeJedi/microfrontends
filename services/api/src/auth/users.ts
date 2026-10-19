export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
}

// In-memory demo seed: one user with a plain-text password. A demo login, not a user store.
// The standalone dev login of the remotes mirrors these credentials (packages/api-client/src/dev-credentials.ts).
const USERS: User[] = [
  { id: 'u-1', name: 'Demo Buyer', email: 'buyer@example.com', password: 'demo-password' },
];

export function findUserByCredentials(email: string, password: string): User | undefined {
  return USERS.find((user) => user.email === email && user.password === password);
}
