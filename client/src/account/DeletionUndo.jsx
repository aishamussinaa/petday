import { createContext, useContext, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from './ApiContext.jsx';
import './deletionUndo.css';

const UndoContext = createContext({ revision: 0 });
export const useDeletionUndo = () => useContext(UndoContext);

export function DeletionUndo({ children }) {
  const { t } = useTranslation();
  const request = useApi();
  const [entries, setEntries] = useState([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const entry = entries.at(-1);

  function offer(base, record, pet, label = record.title) {
    const url = base + '/' + record.id + '/restore';
    const item = { url, version: record.version + 1, label, pet: pet.name };
    setEntries(previous => [...previous.filter(other => other.url !== url), item]);
    setError(null);
  }

  function dismiss(item) {
    setEntries(previous => previous.filter(other => other !== item));
    setError(null);
  }

  async function restore() {
    if (!entry || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await request(entry.url, { method: 'POST', body: { version: entry.version } });
      dismiss(entry);
      setRevision(value => value + 1);
    } catch (failure) {
      setError({ entry, key: /_(CHANGED|NOT_FOUND)$/.test(failure.code) ? 'undo.unavailable' : 'undo.failed' });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <UndoContext.Provider value={{ offer, revision }}>
    {children}
    {entry && <aside className="undo-notice" aria-label={t('undo.heading')}>
      <div role="status"><strong>{t('undo.deleted', { label: entry.label, pet: entry.pet })}</strong>
        {entries.length > 1 && <small>{t('undo.remaining', { count: entries.length })}</small>}
      </div>
      <button className="button primary" disabled={busy} onClick={restore}>{t('undo.action')}</button>
      <button className="button secondary" disabled={busy} onClick={() => dismiss(entry)}>{t('close')}</button>
      {error?.entry === entry && <p role="alert">{t(error.key)}</p>}
    </aside>}
  </UndoContext.Provider>;
}
