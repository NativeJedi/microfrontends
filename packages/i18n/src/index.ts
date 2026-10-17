// Stateless i18n glue bundled into every app. The i18next instance itself is created once by the shell
// (or by a standalone remote's bootstrap) and reaches remotes through <I18nextProvider>.
export {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type Language,
} from './languages';
export { createI18n } from './create-i18n';
export { type LoadNamespaceBundle } from './namespace-loader-backend';
export { useNamespaceTranslation } from './use-namespace-translation';
