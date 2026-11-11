import { useTranslation } from 'react-i18next';
export default function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return <div role="group" aria-label={t('language')} className="languages">
    {[['ru', 'RU'], ['kk', 'KZ'], ['en', 'EN']].map(([code, label]) => <button key={code} type="button" lang={code} aria-pressed={i18n.resolvedLanguage === code} onClick={() => i18n.changeLanguage(code)}>{label}</button>)}
  </div>;
}
