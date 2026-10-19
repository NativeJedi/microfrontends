import { defineServiceKey } from '@mf/services';
import type { ApiClient } from './http';
import type { Session } from './session';

// Key names are a cross-app contract: the shell registers under them, remotes resolve by them.
export const SESSION_SERVICE = defineServiceKey<Session>('session');
export const API_CLIENT_SERVICE = defineServiceKey<ApiClient>('api-client');
