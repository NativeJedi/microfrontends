import type { BackendModule, i18n, ReadCallback } from 'i18next';
import type { Language } from './languages';

// A dynamic `import()` of a JSON file: webpack emits it as a chunk of the app that owns it and loads it
// from that app's publicPath, so a remote's translations come from the remote's own origin.
export type LoadNamespaceBundle = (language: Language) => Promise<{ default: object }>;

// The i18next backend of the shell's instance. It knows no URLs: every app registers a loader for its own
// namespace, and i18next calls it when that namespace is needed in a language. This method is the
// cross-bundle API: each app has its own copy of this package, so it is found by shape, not by class.
export interface NamespaceLoaderBackend extends BackendModule {
  registerNamespace(namespace: string, loadBundle: LoadNamespaceBundle): void;
}

export function createNamespaceLoaderBackend(): NamespaceLoaderBackend {
  const loaders = new Map<string, LoadNamespaceBundle>();

  return {
    type: 'backend',
    init() {},
    registerNamespace(namespace, loadBundle) {
      loaders.set(namespace, loadBundle);
    },
    read(language, namespace, callback: ReadCallback) {
      const loadBundle = loaders.get(namespace);
      if (!loadBundle) {
        callback(new Error(`No translations registered for namespace "${namespace}"`), false);
        return;
      }
      // Only supported languages reach the backend (`supportedLngs` in createI18n).
      loadBundle(language as Language).then(
        (bundle) => callback(null, bundle.default),
        (error: unknown) =>
          callback(error instanceof Error ? error : new Error(String(error)), false),
      );
    },
  };
}

function isNamespaceLoaderBackend(
  backend: BackendModule | undefined,
): backend is NamespaceLoaderBackend {
  return (
    typeof (backend as Partial<NamespaceLoaderBackend> | undefined)?.registerNamespace ===
    'function'
  );
}

export function registerNamespace(
  instance: i18n,
  namespace: string,
  loadBundle: LoadNamespaceBundle,
): void {
  const backend = instance.modules.backend;
  if (!isNamespaceLoaderBackend(backend)) {
    throw new Error('The i18n instance was not created with createI18n from @mf/i18n');
  }
  backend.registerNamespace(namespace, loadBundle);
}
