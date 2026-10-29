/**
 * Where loading a remote module broke. The fallback UI branches on this: a missing container is a
 * deploy/config mistake and retrying will not help, while a script or timeout failure usually will.
 */
export type RemoteFailureReason =
  /** The runtime remote config (remotes.json) could not be fetched or is malformed. */
  | 'config'
  /** The remote is not in the config at all. */
  | 'unknown-remote'
  /** remoteEntry.js failed to load: network error, 404, CORS, blocked by the browser. */
  | 'script'
  /** remoteEntry.js did not finish loading within the timeout. */
  | 'timeout'
  /** The script loaded but did not define the expected container on `window`. */
  | 'container-missing'
  /** `container.init()` threw: usually a second share scope object on the page. */
  | 'init'
  /** `container.get()` threw: the remote does not expose that module. */
  | 'get'
  /** The module factory threw while the exposed module was being evaluated. */
  | 'evaluate';

interface RemoteLoadErrorContext {
  remote: string;
  reason: RemoteFailureReason;
  module?: string;
  cause?: unknown;
}

/** Every failure inside loadRemote() surfaces as this error, so one error boundary can read it. */
export class RemoteLoadError extends Error {
  readonly remote: string;
  readonly module: string | undefined;
  readonly reason: RemoteFailureReason;

  constructor(message: string, { remote, module, reason, cause }: RemoteLoadErrorContext) {
    super(message, { cause });
    this.name = 'RemoteLoadError';
    this.remote = remote;
    this.module = module;
    this.reason = reason;
  }
}

export function isRemoteLoadError(error: unknown): error is RemoteLoadError {
  return error instanceof RemoteLoadError;
}

/**
 * webpack throws this when a chunk 404s — typically the remote was redeployed under new hashes
 * while this page was open, so the container in memory asks for files that no longer exist.
 * Retrying cannot fix it: only a reload replaces the stale container.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'ChunkLoadError') return true;
  return error instanceof RemoteLoadError && isChunkLoadError(error.cause);
}
