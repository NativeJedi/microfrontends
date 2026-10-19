import { API_CLIENT_SERVICE } from '@mf/api-client';
import { ROUTES } from '@mf/contracts';
import { useService } from '@mf/services';
import { Link, useLocation } from 'react-router';
import { useShellTranslation } from '../i18n/use-shell-translation';
import styles from './AuthControls.module.css';
import { getCurrentPath } from './return-path';
import { useIsLoggedIn } from './use-is-logged-in';

export default function AuthControls() {
  const t = useShellTranslation();
  const api = useService(API_CLIENT_SERVICE);
  const isLoggedIn = useIsLoggedIn();
  const location = useLocation();

  if (!isLoggedIn)
    return <Link to={ROUTES.login(getCurrentPath(location))}>{t('auth.logIn')}</Link>;

  return (
    <button type="button" className={styles.button} onClick={() => void api.logout()}>
      {t('auth.logOut')}
    </button>
  );
}
