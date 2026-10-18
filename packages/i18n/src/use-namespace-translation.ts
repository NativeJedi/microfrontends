import type { TFunction } from 'i18next';
import { useContext } from 'react';
import { I18nContext, useTranslation } from 'react-i18next';
import { type LoadNamespaceBundle, registerNamespace } from './namespace-loader-backend';

// Registers the app's loader on the instance from <I18nextProvider> (the shell's one when hosted), then lets
// react-i18next do the rest: it suspends until i18next has loaded the namespace for the current language.
// From then on i18next reloads every used namespace inside changeLanguage(), before it switches the language.
export function useNamespaceTranslation(
  namespace: string,
  loadBundle: LoadNamespaceBundle,
): TFunction<string> {
  const { i18n: instance } = useContext(I18nContext);
  registerNamespace(instance, namespace, loadBundle);

  return useTranslation(namespace).t;
}
