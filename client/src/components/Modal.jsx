import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
import LanguageSwitch from './LanguageSwitch.jsx';
export default function Modal({ title, onClose, children }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const focusable = [...ref.current.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onKeyDown={keepFocus} onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="modal-top"><LanguageSwitch /><button type="button" className="icon-button" aria-label={t('close')} onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="modal-title">{title}</h2>{children}
  </dialog>;
}
