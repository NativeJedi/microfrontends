import styles from './ThemeToggle.module.css';
import { useTheme } from './use-theme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button type="button" className={styles.toggle} onClick={toggleTheme}>
      Switch to {nextTheme} theme
    </button>
  );
}
