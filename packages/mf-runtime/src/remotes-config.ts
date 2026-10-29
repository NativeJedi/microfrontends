/** One entry of the runtime remote registry. */
export interface RemoteConfig {
  /** Global container name — the `name` of the remote's ModuleFederationPlugin, not its URL path. */
  scope: string;
  /** Absolute URL of the remote's remoteEntry.js. */
  url: string;
  /** Overrides the runtime-wide timeout for this remote only. */
  timeoutMs?: number;
}

/** Keyed by the logical remote name used in code (`loadRemote('catalog', './App')`). */
export type RemotesConfig = Record<string, RemoteConfig>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Narrows fetched JSON into RemotesConfig. The file is served, not imported, so it is an untrusted
 * input like an API response: a typo in it must fail here with a readable message, not later as
 * `undefined is not an object` somewhere inside the container protocol.
 */
export function parseRemotesConfig(value: unknown): RemotesConfig {
  if (!isRecord(value)) throw new TypeError('remotes config must be a JSON object');

  const config: RemotesConfig = {};
  for (const [name, entry] of Object.entries(value)) {
    if (!isRecord(entry)) throw new TypeError(`remote "${name}": entry must be an object`);

    const { scope, url, timeoutMs } = entry;
    if (typeof scope !== 'string' || scope.length === 0) {
      throw new TypeError(`remote "${name}": "scope" must be a non-empty string`);
    }
    if (typeof url !== 'string' || url.length === 0) {
      throw new TypeError(`remote "${name}": "url" must be a non-empty string`);
    }
    if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !(timeoutMs > 0))) {
      throw new TypeError(`remote "${name}": "timeoutMs" must be a positive number`);
    }

    config[name] = timeoutMs === undefined ? { scope, url } : { scope, url, timeoutMs };
  }
  return config;
}

/** Fetches the registry. `no-store`: runtime config must never be served from the HTTP cache. */
export async function fetchRemotesConfig(url: string, timeoutMs: number): Promise<RemotesConfig> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${url} responded with ${response.status}`);
  return parseRemotesConfig(await response.json());
}
