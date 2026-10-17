import { isSupportedLanguage, SUPPORTED_LANGUAGES } from '@mf/i18n';
import styles from './LanguageSwitcher.module.css';
import { useLanguage } from './use-language';
import { useShellTranslation } from './use-shell-translation';

export default function LanguageSwitcher() {
  const t = useShellTranslation();
  const { language, changeLanguage } = useLanguage();

  return (
    <select
      className={styles.select}
      aria-label={t('language.label')}
      value={language}
      onChange={(event) => {
        if (isSupportedLanguage(event.target.value)) changeLanguage(event.target.value);
      }}
    >
      {SUPPORTED_LANGUAGES.map((option) => (
        <option key={option} value={option}>
          {t(`language.${option}`)}
        </option>
      ))}
    </select>
  );
}
