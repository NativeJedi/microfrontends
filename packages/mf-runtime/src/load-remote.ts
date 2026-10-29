import { RemoteLoadError, type RemoteFailureReason } from './errors';
import { loadScript, ScriptTimeoutError } from './load-script';
import { fetchRemotesConfig, type RemoteConfig, type RemotesConfig } from './remotes-config';

// Globals that webpack injects into every bundle built with ModuleFederationPlugin. They are
// missing from @types/webpack-env, and declaring them here keeps `tsc --noEmit` honest without
// widening anything to `any`. `declare` inside a module is erased, so nothing reaches the output.

/** Creates the share scope and fills it with the modules this bundle declared as `shared`. */
declare const __webpack_init_sharing__: (scopeName: string) => Promise<void>;

/** The share scopes of this bundle, keyed by scope name (we only ever use 'default'). */
declare const __webpack_share_scopes__: Record<string, unknown>;

/**
 * What remoteEntry.js puts on `window[scope]`. `init` hands the container our share scope so it
 * reuses our React instead of its own copy; `get` returns a factory for one exposed module.
 */
interface RemoteContainer {
  init(shareScope: unknown): void | Promise<void>;
  get(module: string): Promise<() => unknown>;
}

export interface RemotesRuntimeOptions {
  /** URL of the runtime registry, served by the host (never bundled into it). */
  configUrl: string;
  timeoutMs?: number;
  /** Extra attempts after the first one, for transient failures only. */
  retries?: number;
  retryDelayMs?: number;
}

type ResolvedOptions = Required<RemotesRuntimeOptions>;

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 300;

/**
 * A missing expose or a container that never appeared is a deploy mistake: retrying it only
 * delays the fallback UI. Network-shaped failures are the ones worth a second attempt.
 */
const RETRYABLE_REASONS: ReadonlySet<RemoteFailureReason> = new Set([
  'config',
  'script',
  'timeout',
]);

let options: ResolvedOptions | undefined;
let configPromise: Promise<RemotesConfig> | undefined;
const containers = new Map<string, Promise<RemoteContainer>>();
const modules = new Map<string, Promise<unknown>>();

/**
 * Called once per host, in its bootstrap. The module-level state is deliberate: this package is
 * bundled into each host (not MF-shared), so every host gets its own registry and its own caches.
 */
export function configureRemotes(runtimeOptions: RemotesRuntimeOptions): void {
  options = {
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    ...runtimeOptions,
  };
  resetRemotes();
}

/**
 * Drops cached promises so the next load starts over. The registry is always dropped with them:
 * a remote that has to be loaded again is exactly the case where its URL may have changed, and a
 * registry cached for the lifetime of the page would hide that.
 *
 * It cannot un-execute remoteEntry.js: the container object stays on `window`, so a reset re-runs
 * init() and get() against the same one. Replacing a container that is already in memory takes a
 * page reload.
 */
export function resetRemotes(remote?: string): void {
  configPromise = undefined;

  if (remote === undefined) {
    containers.clear();
    modules.clear();
    return;
  }
  containers.delete(remote);
  for (const key of modules.keys()) {
    if (key.startsWith(`${remote}|`)) modules.delete(key);
  }
}

/**
 * Loads one exposed module of one remote, by hand:
 * inject remoteEntry.js → read `window[scope]` → init the share scope → get the module factory.
 *
 * The result is cached per module; a rejected attempt is never cached, so a "Retry" in the UI
 * really starts over.
 */
export function loadRemote<T>(remote: string, module: string): Promise<T> {
  return cached(modules, `${remote}|${module}`, async () => {
    const resolved = requireOptions();
    const config = await loadConfig(remote, resolved);

    const entry = config[remote];
    if (!entry) {
      throw new RemoteLoadError(`Remote "${remote}" is not listed in ${resolved.configUrl}`, {
        remote,
        module,
        reason: 'unknown-remote',
      });
    }

    const container = await loadContainer(remote, entry, resolved);

    let factory: () => unknown;
    try {
      factory = await container.get(module);
    } catch (cause) {
      throw new RemoteLoadError(`Remote "${remote}" does not expose "${module}"`, {
        remote,
        module,
        reason: 'get',
        cause,
      });
    }

    try {
      // `await`, not a bare return: an exposed module that itself consumes a remote is an async
      // module, and webpack hands back a thenable namespace. Returning it unawaited would let its
      // rejection escape this try/catch and surface as a raw error instead of a RemoteLoadError.
      return await factory();
    } catch (cause) {
      throw new RemoteLoadError(`"${module}" of remote "${remote}" threw while being evaluated`, {
        remote,
        module,
        reason: 'evaluate',
        cause,
      });
    }
  }) as Promise<T>;
}

function requireOptions(): ResolvedOptions {
  if (!options) throw new Error('configureRemotes() must be called before loadRemote()');
  return options;
}

function loadConfig(remote: string, resolved: ResolvedOptions): Promise<RemotesConfig> {
  configPromise ??= withRetries(
    () =>
      fetchRemotesConfig(resolved.configUrl, resolved.timeoutMs).catch((cause: unknown) => {
        throw new RemoteLoadError(`Cannot read the remote registry at ${resolved.configUrl}`, {
          remote,
          reason: 'config',
          cause,
        });
      }),
    resolved,
  ).catch((error: unknown) => {
    configPromise = undefined;
    throw error;
  });
  return configPromise;
}

function loadContainer(
  remote: string,
  entry: RemoteConfig,
  resolved: ResolvedOptions,
): Promise<RemoteContainer> {
  return cached(containers, remote, () =>
    withRetries(() => initContainer(remote, entry, resolved), resolved),
  );
}

async function initContainer(
  remote: string,
  entry: RemoteConfig,
  resolved: ResolvedOptions,
): Promise<RemoteContainer> {
  // A previous attempt may have timed out while the browser kept loading the script: if the
  // container is already there, the entry does not need to be fetched again.
  if (!readContainer(entry.scope)) {
    try {
      await loadScript(entry.url, entry.timeoutMs ?? resolved.timeoutMs);
    } catch (cause) {
      throw new RemoteLoadError(`Remote "${remote}" could not be fetched from ${entry.url}`, {
        remote,
        reason: cause instanceof ScriptTimeoutError ? 'timeout' : 'script',
        cause,
      });
    }
  }

  const container = readContainer(entry.scope);
  if (!container) {
    throw new RemoteLoadError(
      `${entry.url} loaded but defined no container named "${entry.scope}"`,
      { remote, reason: 'container-missing' },
    );
  }

  // Order matters: fill our own share scope first, then hand that same object to the container.
  // Skipping this leaves the remote with its own React — the classic "Invalid hook call".
  await __webpack_init_sharing__('default');
  try {
    await container.init(__webpack_share_scopes__.default);
  } catch (cause) {
    throw new RemoteLoadError(`Remote "${remote}" rejected our share scope`, {
      remote,
      reason: 'init',
      cause,
    });
  }

  return container;
}

function readContainer(scope: string): RemoteContainer | undefined {
  const candidate = (globalThis as unknown as Record<string, unknown>)[scope];
  if (typeof candidate !== 'object' || candidate === null) return undefined;

  const { init, get } = candidate as Partial<RemoteContainer>;
  return typeof init === 'function' && typeof get === 'function'
    ? (candidate as RemoteContainer)
    : undefined;
}

/** Caches the in-flight promise, but never a rejected one — otherwise "Retry" would be a no-op. */
function cached<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  create: () => Promise<T>,
): Promise<T> {
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = create().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

async function withRetries<T>(
  operation: () => Promise<T>,
  { retries, retryDelayMs }: ResolvedOptions,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isTransient = error instanceof RemoteLoadError && RETRYABLE_REASONS.has(error.reason);
      if (!isTransient || attempt >= retries) throw error;
      await delay(retryDelayMs * 2 ** attempt);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
