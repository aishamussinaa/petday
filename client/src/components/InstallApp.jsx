import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal.jsx';
import '../account/care.css';

export default function InstallApp() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(() => window.petdayInstallPrompt || null), [help, setHelp] = useState(false), [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  useEffect(() => {
    const ready = event => { event.preventDefault(); setPrompt(event); };
    const done = () => { setInstalled(true); setPrompt(null); window.petdayInstallPrompt = null; };
    window.addEventListener('beforeinstallprompt', ready); window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', ready); window.removeEventListener('appinstalled', done); };
  }, []);
  async function install() {
    if (!prompt) { setHelp(true); return; }
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; } catch { setHelp(true); }
    finally { window.petdayInstallPrompt = null; setPrompt(null); setBusy(false); }
  }
  if (installed) return null;
  return <><aside className="install-app"><p>{t('care.installHint')}</p><button className="button secondary" disabled={busy} onClick={install}>{t('care.install')}</button></aside>{help && <Modal title={t('care.install')} onClose={() => setHelp(false)}><div className="install-instructions"><p><strong>iPhone / iPad</strong><br />{t('care.installIos')}</p><p><strong>Android / Chrome / Edge</strong><br />{t('care.installOther')}</p><p className="muted">{t('care.installOnline')}</p></div></Modal>}</>;
}
