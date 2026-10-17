import { DEFAULT_LANGUAGE, isSupportedLanguage, type Language } from '@mf/i18n';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGE_STORAGE_KEY = 'shell:language';

// localStorage is untrusted: anything but a supported language falls back to the default.
export function readStoredLanguage(): Language {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}

// The shell owns the current language. Remotes need no contract for it: they read it from the shared
// i18next instance and re-render on its "languageChanged" event.
export function useLanguage() {
  const { i18n } = useTranslation();
  const language = isSupportedLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  // i18next first loads the new language of every namespace used so far (one request per app), and only
  // then emits "languageChanged": all apps switch in one render, with no loading fallback in between.
  const changeLanguage = (next: Language) => void i18n.changeLanguage(next);

  return { language, changeLanguage };
}
