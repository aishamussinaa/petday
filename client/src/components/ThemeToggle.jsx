import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme.jsx';
import Icon from './Icon.jsx';

export default function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const label = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  return <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={label} title={label}>
    <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={24} />
  </button>;
}
