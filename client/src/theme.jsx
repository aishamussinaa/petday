import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';

const ThemeContext = createContext(null);
const storageKey = 'petday.theme';
const valid = value => ['light', 'dark'].includes(value) ? value : null;
function savedPreference() {
  try { return valid(localStorage.getItem(storageKey)); } catch { return null; }
}
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(savedPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = preference || (systemDark ? 'dark' : 'light');
  useLayoutEffect(() => {
    const background = theme === 'dark' ? '#201c24' : '#fff8ec';
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }, [theme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystem = () => setSystemDark(media.matches);
    const updateStorage = event => {
      if (event.key === storageKey || event.key === null) setPreference(savedPreference());
    };
    updateSystem();
    media.addEventListener('change', updateSystem);
    window.addEventListener('storage', updateStorage);
    return () => { media.removeEventListener('change', updateSystem); window.removeEventListener('storage', updateStorage); };
  }, []);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setPreference(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Keep the choice for this session. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export const useTheme = () => useContext(ThemeContext);
