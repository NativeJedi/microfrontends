import { useShellTranslation } from '../i18n/use-shell-translation';
import styles from './ThemeToggle.module.css';
import { useTheme } from './use-theme';

export default function ThemeToggle() {
  const t = useShellTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme}>
      {theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
    </button>
  );
}
