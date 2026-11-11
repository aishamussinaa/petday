import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './Icon.jsx';
export default function Diagnostics() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('checking');
  const [text, setText] = useState('');
  const active = useRef(null);
  async function check() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setStatus('checking');
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('/api/health', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('HTTP');
      if ((await response.json())?.status !== 'ok') throw new Error('Invalid response');
      if (active.current === controller) setStatus('success');
    } catch { if (active.current === controller) setStatus('error'); }
    finally { clearTimeout(timeout); }
  }
  useEffect(() => { check(); return () => { const controller = active.current; active.current = null; controller?.abort(); }; }, []);
  return <details className="dev-panel"><summary><Icon name="code" size={17} />{t('diagnostics.title')}</summary><div className="dev-content">
    <div><p role="status" className={status}>{t(`diagnostics.${status}`)}</p><button className="button secondary" onClick={check} disabled={status === 'checking'}>{t('diagnostics.retry')}</button></div>
    <div><label htmlFor="test-text">{t('diagnostics.field')}</label><input id="test-text" value={text} onChange={event => setText(event.target.value)} aria-describedby="test-hint" /><p id="test-hint" className="muted small">{t('diagnostics.hint')}</p></div>
  </div></details>;
}
