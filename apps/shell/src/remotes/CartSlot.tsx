import { ROUTES } from '@mf/contracts';
import { RemoteSlot } from '@mf/runtime';
import { Link } from 'react-router';
import { useShellTranslation } from '../i18n/use-shell-translation';
import styles from './CartSlot.module.css';
import { RetryButton } from './RemoteFallback';
import type { CartWidgetProps } from './remote-props';

/**
 * The header counter, in its own slot. When cart is down the shell degrades instead of breaking:
 * the link to the cart page stays (that route has its own slot and its own fallback), only the
 * live item count disappears.
 */
export default function CartSlot() {
  const t = useShellTranslation();

  return (
    <RemoteSlot<CartWidgetProps>
      remote="cart"
      module="./CartWidget"
      props={{ label: t('nav.cart') }}
      pending={<span>{t('cartLoading')}</span>}
      fallback={({ retry, canRetry }) => (
        <span className={styles.degraded} title={t('remote.cartDegraded')}>
          <Link to={ROUTES.cart}>{t('nav.cart')}</Link>
          <RetryButton retry={retry} canRetry={canRetry} />
        </span>
      )}
    />
  );
}
