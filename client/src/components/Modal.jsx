import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
import ThemeToggle from './ThemeToggle.jsx';
export default function Modal({ title, onClose, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close(); document.body.style.overflow = previousOverflow;
      const target = previous?.isConnected && !previous.matches(':disabled') ? previous : document.querySelector('main');
      target?.focus({ preventScroll: true });
    };
  }, []);
  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...ref.current.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')].filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); ref.current.focus(); return; }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-top"><LanguageSwitch /><ThemeToggle /><button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="modal-title">{title}</h2>{children}
  </dialog>;
}
