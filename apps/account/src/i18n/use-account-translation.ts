import { type Language, useNamespaceTranslation } from '@mf/i18n';

// account owns its namespace and its texts. A dynamic import() becomes a chunk of this remote, loaded from
// its publicPath ('auto' → the origin of remoteEntry.js), so the shell never needs to know where it lives.
const loadAccountBundle: Record<Language, () => Promise<{ default: object }>> = {
  en: () => import(/* webpackChunkName: "locale-en" */ './locales/en.json'),
  uk: () => import(/* webpackChunkName: "locale-uk" */ './locales/uk.json'),
};

export function useAccountTranslation() {
  return useNamespaceTranslation('account', (language) => loadAccountBundle[language]());
}
