/** The <script> never finished within the timeout. */
export class ScriptTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Loading ${url} timed out after ${timeoutMs}ms`);
    this.name = 'ScriptTimeoutError';
  }
}

/** The browser fired `error` on the <script>: network failure, 404, CORS, blocked request. */
export class ScriptLoadError extends Error {
  constructor(url: string) {
    super(`Failed to load ${url}`);
    this.name = 'ScriptLoadError';
  }
}

/**
 * Injects a <script> and resolves once the browser has executed it.
 *
 * This is the part `import('catalog/App')` normally hides: with static remotes webpack generates
 * exactly this, with the URL baked in at build time. Doing it by hand is what lets the URL come
 * from a runtime registry.
 *
 * On failure the element is removed so a retry starts from a clean DOM; on success it stays, so
 * the loaded remote entries remain visible in devtools.
 */
export function loadScript(url: string, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.type = 'text/javascript';

    const timer = setTimeout(() => {
      // The request may still complete afterwards and define the container; the next attempt
      // then finds it already on `window` and skips straight to init().
      fail(new ScriptTimeoutError(url, timeoutMs));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    }

    function fail(error: Error) {
      cleanup();
      script.remove();
      reject(error);
    }

    script.onload = () => {
      cleanup();
      resolve();
    };
    script.onerror = () => fail(new ScriptLoadError(url));

    document.head.append(script);
  });
}
