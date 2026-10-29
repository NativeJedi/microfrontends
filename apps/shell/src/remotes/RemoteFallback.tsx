import { isRemoteLoadError, type RemoteFallbackState } from '@mf/runtime';
import { useShellTranslation } from '../i18n/use-shell-translation';
import styles from './RemoteFallback.module.css';

interface RemoteFallbackProps extends RemoteFallbackState {
  /** What is missing, in the user's language — the nav label of the remote. */
  name: string;
}

/** Fallback for a remote that owns a whole route: the rest of the shell stays usable around it. */
export default function RemoteFallback({ name, error, retry, canRetry }: RemoteFallbackProps) {
  const t = useShellTranslation();

  return (
    <div className={styles.fallback} role="alert">
      <p className={styles.title}>{t('remote.unavailable', { name })}</p>
      <p className={styles.detail}>{describeError(error)}</p>
      <RetryButton retry={retry} canRetry={canRetry} />
    </div>
  );
}

/**
 * A stale container cannot be fixed by loading it again — the page has to go. Everything else is
 * worth one more attempt, and the attempt is a real one: the failed promise was never cached.
 */
export function RetryButton({ retry, canRetry }: Pick<RemoteFallbackState, 'retry' | 'canRetry'>) {
  const t = useShellTranslation();

  return (
    <button
      type="button"
      className={styles.retry}
      onClick={canRetry ? retry : () => window.location.reload()}
    >
      {canRetry ? t('remote.retry') : t('remote.reload')}
    </button>
  );
}

/** The reason is the useful half: a dead remote, a wrong URL and a missing expose look alike. */
function describeError(error: unknown): string {
  if (isRemoteLoadError(error)) return `${error.reason}: ${error.message}`;
  return error instanceof Error ? error.message : String(error);
}
