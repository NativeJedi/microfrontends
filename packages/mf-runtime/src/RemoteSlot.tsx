import { lazy, Suspense, useCallback, useState, type ComponentType, type ReactNode } from 'react';
import { isChunkLoadError } from './errors';
import { loadRemote, resetRemotes } from './load-remote';
import { RemoteErrorBoundary } from './RemoteErrorBoundary';

export interface RemoteFallbackState {
  error: unknown;
  /** Starts a fresh load of the remote module. */
  retry: () => void;
  /** False when retrying cannot help and only a full page reload can (stale container). */
  canRetry: boolean;
}

interface RemoteSlotProps<P> {
  /** Logical name, as used as a key in the runtime registry. */
  remote: string;
  /** Exposed module path, e.g. './App'. */
  module: string;
  props?: P;
  pending?: ReactNode;
  fallback: (state: RemoteFallbackState) => ReactNode;
}

/** Shape of an exposed React module: a default export, per the convention in docs/SPEC.md. */
type RemoteModule<P> = { default: ComponentType<P> };

/**
 * One isolated remote slot: suspense while it loads, a fallback when it fails, and a retry that
 * really reloads it. `remote` and `module` are read once — give the slot a `key` if they change.
 */
export function RemoteSlot<P extends object = Record<string, never>>({
  remote,
  module,
  props,
  pending = null,
  fallback,
}: RemoteSlotProps<P>) {
  const createComponent = useCallback(
    () => lazy(() => loadRemote<RemoteModule<P>>(remote, module)),
    [remote, module],
  );

  // React.lazy caches the outcome of its loader on the component type itself, a rejection
  // included. Retrying therefore means a brand new lazy component: remounting the old one would
  // rethrow the very same error without calling loadRemote again.
  const [Component, setComponent] = useState(createComponent);
  const [resetKey, setResetKey] = useState(0);

  const retry = useCallback(() => {
    // Forget everything known about this remote first, the registry entry included: a retry is
    // also how a remote that moved to a new URL gets picked up without a reload.
    resetRemotes(remote);
    setComponent(() => createComponent());
    setResetKey((key) => key + 1);
  }, [createComponent, remote]);

  return (
    <RemoteErrorBoundary
      resetKey={resetKey}
      fallback={(error) => fallback({ error, retry, canRetry: !isChunkLoadError(error) })}
    >
      <Suspense fallback={pending}>
        <Component {...((props ?? {}) as P)} />
      </Suspense>
    </RemoteErrorBoundary>
  );
}
