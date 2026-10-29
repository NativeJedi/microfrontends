import { API_CLIENT_SERVICE, type Credentials, DEV_CREDENTIALS, HttpError } from '@mf/api-client';
import { useService } from '@mf/services';
import { useMutation } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { useShellTranslation } from '../i18n/use-shell-translation';
import styles from './LoginPage.module.css';
import { toSafeReturnPath } from './return-path';
import { useIsLoggedIn } from './use-is-logged-in';

// Dev convenience: the form starts filled with the seeded demo user. Production builds start empty.
const INITIAL_CREDENTIALS: Credentials =
  process.env.NODE_ENV === 'production' ? { email: '', password: '' } : DEV_CREDENTIALS;

function readCredentials(form: HTMLFormElement): Credentials {
  const data = new FormData(form);
  return { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') };
}

export default function LoginPage() {
  const t = useShellTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const isLoggedIn = useIsLoggedIn();
  const [searchParams] = useSearchParams();
  const login = useMutation({ mutationFn: (credentials: Credentials) => api.login(credentials) });

  // Covers both a successful login and opening /login while already logged in.
  if (isLoggedIn) return <Navigate to={toSafeReturnPath(searchParams.get('returnTo'))} replace />;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(readCredentials(event.currentTarget));
  }

  const isWrongCredentials = login.error instanceof HttpError && login.error.status === 401;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>{t('auth.title')}</h2>
      <label className={styles.field}>
        {t('auth.email')}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={INITIAL_CREDENTIALS.email}
        />
      </label>
      <label className={styles.field}>
        {t('auth.password')}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={INITIAL_CREDENTIALS.password}
        />
      </label>
      <button type="submit" className={styles.button} disabled={login.isPending}>
        {login.isPending ? t('auth.loggingIn') : t('auth.logIn')}
      </button>
      {login.error && (
        <p>{isWrongCredentials ? t('auth.wrongCredentials') : t('auth.loginFailed')}</p>
      )}
    </form>
  );
}
