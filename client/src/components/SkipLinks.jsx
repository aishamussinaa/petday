import { useTranslation } from 'react-i18next';

export default function SkipLinks({ mainId, navigationId }) {
  const { t } = useTranslation();
  function jump(event, id) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  return <>
    <a className="skip-link" href={`#${mainId}`} onClick={event => jump(event, mainId)}>{t('landing.skip')}</a>
    {navigationId && <a className="skip-link" href={`#${navigationId}`} onClick={event => jump(event, navigationId)}>{t('keyboard.sections')}</a>}
  </>;
}
