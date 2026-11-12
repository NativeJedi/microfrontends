import { type Language, useNamespaceTranslation } from '@mf/i18n';

// The widget owns its namespace and its texts, named after its container (SPEC section 6). A dynamic
// import() becomes a chunk of this widget, loaded from its publicPath ('auto' → the origin of its
// remoteEntry.js), so neither the dashboard nor the shell needs to know where it lives.
const loadBundle: Record<Language, () => Promise<{ default: object }>> = {
  en: () => import(/* webpackChunkName: "locale-en" */ './locales/en.json'),
  uk: () => import(/* webpackChunkName: "locale-uk" */ './locales/uk.json'),
};

export function useSalesWidgetTranslation() {
  return useNamespaceTranslation('widget_sales', (language) => loadBundle[language]());
}
