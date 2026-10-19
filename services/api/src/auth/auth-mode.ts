import { SetMetadata } from '@nestjs/common';

// required (default): a valid access token is needed.
// optional: anonymous requests pass, but a token that is present must be valid (bad credentials → 401).
// none: the access token is ignored (auth endpoints: refresh must work while the access token is expired).
export type AuthModeValue = 'required' | 'optional' | 'none';

export const AUTH_MODE_KEY = 'authMode';

export const AuthMode = (mode: AuthModeValue) => SetMetadata(AUTH_MODE_KEY, mode);
