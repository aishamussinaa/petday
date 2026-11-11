import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { formatDate } from '../dateUtils.js';
import { request } from './api.js';
import './health.css';

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localDay = value => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); };
function ErrorNotice({ code }) {
  const { t } = useTranslation();
  return code ? <p className="form-error" role="alert">{t(`medical.errors.${code}`, { defaultValue: t(`account.errors.${code}`, { defaultValue: t('account.errors.INTERNAL_ERROR') }) })}</p> : null;
}

function HealthForm({ record, kind, today, onClose, onSave }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => record ? { ...record, nextDate: record.nextDate || '' } : { id: crypto.randomUUID(), kind, status: 'planned', title: '', date: today, nextDate: '', clinic: '', vet: '', notes: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const pending = useRef(false);
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    if (!draft.title.trim()) { setError('HEALTH_TITLE'); document.getElementById('health-title')?.focus(); return; }
    pending.current = true; setBusy(true); setError(null);
    try { await onSave(draft); onClose(); }
    catch (failure) { setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title={t(record ? 'medical.edit' : 'medical.add')} onClose={() => { if (!pending.current) onClose(); }}>
    <form className="pet-form health-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-columns">{['kind', 'status'].map(key => <div key={key}><label htmlFor={`health-${key}`}>{t(`medical.${key}`)}</label><select id={`health-${key}`} value={draft[key]} disabled={busy} onChange={e => change(key, e.target.value)}>{(key === 'kind' ? ['vaccine', 'visit'] : ['planned', 'completed']).map(value => <option key={value} value={value}>{t(`medical.${value}`)}</option>)}</select></div>)}</div>
      <label htmlFor="health-title">{t(draft.kind === 'vaccine' ? 'medical.vaccineTitle' : 'medical.visitTitle')} *</label>
      <input id="health-title" autoFocus required maxLength={120} value={draft.title} disabled={busy} onChange={e => change('title', e.target.value)} />
      <div className="form-columns"><div><label htmlFor="health-date">{t('medical.date')} *</label><input id="health-date" type="date" required min="1900-01-01" max={draft.status === 'completed' ? today : '2100-12-31'} value={draft.date} disabled={busy} onChange={e => change('date', e.target.value)} /></div><div><label htmlFor="health-nextDate">{t('medical.nextDate')}</label><input id="health-nextDate" type="date" min={draft.date || '1900-01-01'} max="2100-12-31" value={draft.nextDate} disabled={busy} onChange={e => change('nextDate', e.target.value)} /></div></div>
      <p className="small muted">{t('medical.nextHint')}</p>
      {['clinic', 'vet'].map(key => <div className="health-field" key={key}><label htmlFor={`health-${key}`}>{t(`medical.${key}`)}</label><input id={`health-${key}`} maxLength={key === 'clinic' ? 160 : 120} value={draft[key]} disabled={busy} onChange={e => change(key, e.target.value)} /></div>)}
      <label htmlFor="health-notes">{t('medical.notes')}</label><textarea id="health-notes" rows={3} maxLength={4000} value={draft.notes} disabled={busy} onChange={e => change('notes', e.target.value)} />
      <ErrorNotice code={error} /><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy ? 'account.saving' : 'account.save')}</button></div>
    </form>
  </Modal>;
}

export default function Health({ pet, today }) {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'), [modal, setModal] = useState(null), [busy, setBusy] = useState(false);
  const generation = useRef(0), pending = useRef(false);
  const base = `/pets/${pet.id}/health`, date = dayKey(today);
  async function load() {
    const current = ++generation.current; setLoading(true); setError(null);
    try { const result = await request(base); if (current === generation.current) setRecords(result.records); }
    catch (failure) { if (current === generation.current) { setError(failure.code); setRecords([]); } }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { generation.current++; }; }, [pet.id]);
  async function save(draft) {
    try {
      const { record } = await request(`${base}${modal.record ? `/${draft.id}` : ''}`, { method: modal.record ? 'PUT' : 'POST', body: { ...draft, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      setRecords(previous => [...previous.filter(item => item.id !== record.id), record]); setError(null);
    } catch (failure) { if (['HEALTH_CHANGED', 'HEALTH_NOT_FOUND'].includes(failure.code)) await load(); throw failure; }
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await request(`${base}/${modal.record.id}`, { method: 'DELETE', body: { version: modal.record.version } }); setRecords(previous => previous.filter(item => item.id !== modal.record.id)); setModal(null); }
    catch (failure) { if (['HEALTH_CHANGED', 'HEALTH_NOT_FOUND'].includes(failure.code)) { setModal(null); await load(); } setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  const visible = records.filter(record => filter === 'all' || record.kind === filter);
  const showDate = value => formatDate(localDay(value), i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
  return <section className="health-panel" aria-label={t('medical.heading', { name: pet.name })}>
    <header className="health-heading"><div><p className="eyebrow">{t('medical.eyebrow')}</p><h2>{t('medical.heading', { name: pet.name })}</h2><p className="muted">{t('medical.intro')}</p></div><div className="health-add"><button className="button primary" onClick={() => setModal({ type: 'form', kind: 'vaccine' })}><Icon name="plus" />{t('medical.addVaccine')}</button><button className="button secondary" onClick={() => setModal({ type: 'form', kind: 'visit' })}><Icon name="plus" />{t('medical.addVisit')}</button></div></header>
    {pet.allergies && <aside className="health-allergies"><strong>{t('account.allergies')}</strong><p>{pet.allergies}</p></aside>}
    <div className="health-filters" role="group" aria-label={t('medical.filter')}>{['all', 'vaccine', 'visit'].map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`medical.${value}`)}</button>)}</div>
    <ErrorNotice code={error} />{error && <button className="button secondary" onClick={load}>{t('account.retry')}</button>}
    {loading ? <p role="status">{t('account.loading')}</p> : !visible.length && !error ? <div className="health-empty"><Icon name="health" size={48} /><h3>{t(records.length ? 'medical.emptyFilter' : 'medical.empty')}</h3><p>{t('medical.emptyText')}</p></div> : ['planned', 'completed'].map(status => {
      const group = visible.filter(record => record.status === status).sort((a, b) => status === 'planned' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
      return group.length > 0 && <section className="health-group" key={status}><h3>{t(status === 'planned' ? 'medical.upcoming' : 'medical.history')} <span>{group.length}</span></h3><ul className="health-list">{group.map(record => <li key={record.id} className="medical-record"><div className="medical-record-top"><span className={`health-tag ${record.kind}`}>{t(`medical.${record.kind}`)}</span><span className={`health-state ${status === 'planned' && record.date < date ? 'is-overdue' : ''}`}>{t(status === 'planned' && record.date < date ? 'medical.overdue' : `medical.${status}`)}</span></div><h4>{record.title}</h4><time dateTime={record.date}>{showDate(record.date)}</time><dl>{['clinic', 'vet'].filter(key => record[key]).map(key => <div key={key}><dt>{t(`medical.${key}`)}</dt><dd>{record[key]}</dd></div>)}</dl>{record.nextDate && <p className="health-next"><strong>{t(record.kind === 'vaccine' ? 'medical.nextVaccine' : 'medical.nextVisit')}</strong> <time dateTime={record.nextDate}>{showDate(record.nextDate)}</time></p>}{record.notes && <p className="health-notes">{record.notes}</p>}<div className="health-actions"><button className="button secondary" onClick={() => setModal({ type: 'form', record })}>{t('account.edit')}</button><button className="health-remove" onClick={() => { setError(null); setModal({ type: 'delete', record }); }}>{t('account.confirmDelete')}</button></div></li>)}</ul></section>;
    })}
    {modal?.type === 'form' && <HealthForm record={modal.record} kind={modal.kind} today={date} onClose={() => setModal(null)} onSave={save} />}
    {modal?.type === 'delete' && <Modal title={t('medical.deleteTitle')} onClose={() => { if (!pending.current) setModal(null); }}><p className="delete-explanation">{t('medical.deleteText', { title: modal.record.title })}</p><ErrorNotice code={error} /><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={remove}>{t(busy ? 'account.wait' : 'account.confirmDelete')}</button></div></Modal>}
  </section>;
}
