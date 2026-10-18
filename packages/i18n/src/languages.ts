export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isSupportedLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}
