import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import kk from './locales/kk.json';
import en from './locales/en.json';

export const languageKey = 'petday.language';
const supported = ['ru', 'kk', 'en'];
let language = 'ru';
try {
  const saved = localStorage.getItem(languageKey);
  if (supported.includes(saved)) language = saved;
} catch { /* Интерфейс работает и при недоступном хранилище. */ }

function syncLanguage(lng) {
  document.documentElement.lang = lng;
  try { localStorage.setItem(languageKey, lng); } catch { /* Настройка останется в памяти. */ }
}
i18n.on('languageChanged', syncLanguage);
i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, kk: { translation: kk }, en: { translation: en } },
  lng: language,
  fallbackLng: 'ru',
  supportedLngs: supported,
  interpolation: { escapeValue: false },
});
syncLanguage(language);
export default i18n;
