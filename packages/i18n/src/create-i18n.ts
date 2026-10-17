import i18next, { type i18n } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type Language } from './languages';
import { createNamespaceLoaderBackend } from './namespace-loader-backend';

// Called only from a bootstrap.tsx: by the shell, or by a remote running standalone. A hosted remote
// never creates or inits an instance; it adds its namespace to the shell's one (see useNamespaceTranslation).
// A separate instance (not the i18next default export) means a stray `i18next.init()` elsewhere cannot reset it.
export function createI18n(language: Language): i18n {
  const instance = i18next.createInstance();

  void instance
    .use(createNamespaceLoaderBackend())
    .use(initReactI18next)
    .init({
      lng: language,
      // No fallback language: it would download a second bundle per namespace that is rarely used.
      fallbackLng: false,
      supportedLngs: SUPPORTED_LANGUAGES,
      // Namespaces are registered by their owner apps at runtime; nothing is preloaded.
      ns: [],
      defaultNS: false,
      // React already escapes rendered strings.
      interpolation: { escapeValue: false },
    });

  return instance;
}
