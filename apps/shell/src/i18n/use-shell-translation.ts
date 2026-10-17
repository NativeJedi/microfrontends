import { type Language, useNamespaceTranslation } from '@mf/i18n';

// Each app owns one namespace named after its container. Chunks are named for the Network tab.
const loadShellBundle: Record<Language, () => Promise<{ default: object }>> = {
  en: () => import(/* webpackChunkName: "locale-en" */ './locales/en.json'),
  uk: () => import(/* webpackChunkName: "locale-uk" */ './locales/uk.json'),
};

export function useShellTranslation() {
  return useNamespaceTranslation('shell', (language) => loadShellBundle[language]());
}
