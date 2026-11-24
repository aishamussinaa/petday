import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import { request } from './api.js';
import { dayKey, localDay } from './careOverview.js';
import { formatDate } from '../dateUtils.js';
import './care.css';

const sort = records => [...records].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
export function WeightChart({ records }) {
  const { t, i18n } = useTranslation();
  if (!records.length) return null;
  const values = records.map(record => record.kg), low = Math.min(...values), high = Math.max(...values);
  const pad = Math.max((high - low) * .2, high * .02, .01), min = Math.max(0, low - pad), max = high + pad;
  const first = localDay(records[0].date).getTime(), last = localDay(records.at(-1).date).getTime();
  const points = records.map(record => ({ ...record, x: last === first ? 320 : 66 + (localDay(record.date).getTime() - first) / (last - first) * 520, y: 190 - (record.kg - min) / (max - min) * 160 }));
  const number = value => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(value);
  return <svg className="weight-chart" viewBox="0 0 640 240" role="img" aria-label={t('care.chartLabel')}>
    {[0, .5, 1].map(n => <g key={n}><line x1="66" x2="586" y1={190 - n * 160} y2={190 - n * 160} stroke="currentColor" opacity=".18" /><text x="55" y={195 - n * 160} textAnchor="end">{number(min + (max - min) * n)}</text></g>)}
    <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" />
    {points.map(p => <circle key={p.id} cx={p.x} cy={p.y} r="5" fill="currentColor"><title>{p.date}: {number(p.kg)} {t('care.kg')}</title></circle>)}
    <text x="66" y="225">{records[0].date}</text><text x="586" y="225" textAnchor="end">{records.at(-1).date}</text>
  </svg>;
}
export default function WeightHistory({ pet, today, transport = request }) {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null), [modal, setModal] = useState(null), [busy, setBusy] = useState(false);
  const pending = useRef(false), generation = useRef(0);
  const base = `/pets/${pet.id}/weights`;
  const date = dayKey(today);
  const errorText = code => t(`care.errors.${code}`, { defaultValue: t(`account.errors.${code}`, { defaultValue: t('account.errors.INTERNAL_ERROR') }) });
  async function load() {
    const current = ++generation.current; setLoading(true); setError(null);
    try { const data = await transport(base); if (current === generation.current) setRecords(sort(data.records)); }
    catch (failure) { if (current === generation.current) setError(failure.code); }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { generation.current++; }; }, [pet.id, transport]);
  function open(record) { setError(null); setModal({ type: 'form', edit: Boolean(record), draft: record ? { ...record } : { id: crypto.randomUUID(), date, kg: '', notes: '' } }); }
  async function save(event) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const draft = modal.draft;
      const { record } = await transport(`${base}${modal.edit ? `/${draft.id}` : ''}`, { method: modal.edit ? 'PUT' : 'POST', body: { ...draft, kg: Number(draft.kg), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      setRecords(previous => sort([...previous.filter(item => item.id !== record.id), record])); setModal(null);
    } catch (failure) { if (['WEIGHT_CHANGED', 'WEIGHT_NOT_FOUND'].includes(failure.code)) await load(); setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  async function remove() {
    if (pending.current) return; pending.current = true; setBusy(true); setError(null);
    try { await transport(`${base}/${modal.record.id}`, { method: 'DELETE', body: { version: modal.record.version } }); setRecords(previous => previous.filter(record => record.id !== modal.record.id)); setModal(null); }
    catch (failure) { if (['WEIGHT_CHANGED', 'WEIGHT_NOT_FOUND'].includes(failure.code)) { setModal(null); await load(); } setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  const number = kg => `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(kg)} ${t('care.kg')}`;
  return <section className="weight-panel" aria-label={t('care.weightTitle')}>
    <header className="care-section-heading"><div><h2>{t('care.weightTitle')}</h2><p className="muted">{t('care.weightHint')}</p></div><button className="button secondary" onClick={() => open()}>{t('care.addWeight')}</button></header>
    {error && !modal && <p role="alert" className="form-error">{errorText(error)} <button className="text-link" onClick={load}>{t('account.retry')}</button></p>}
    {loading ? <p role="status">{t('account.loading')}</p> : !records.length ? <p>{t('care.weightEmpty')}</p> : <>
      <p className="weight-latest"><strong>{number(records.at(-1).kg)}</strong><span>{formatDate(localDay(records.at(-1).date), i18n.language)}</span></p>
      <WeightChart records={records} />
      <details className="weight-history"><summary>{t('care.measurements')} · {records.length}</summary><ul>{[...records].reverse().map(record => <li key={record.id}><div><strong>{number(record.kg)}</strong><time dateTime={record.date}>{formatDate(localDay(record.date), i18n.language)}</time>{record.notes && <p>{record.notes}</p>}</div><div className="weight-actions"><button className="button secondary" onClick={() => open(record)}>{t('account.edit')}</button><button className="text-link" onClick={() => { setError(null); setModal({ type: 'delete', record }); }}>{t('account.confirmDelete')}</button></div></li>)}</ul></details>
    </>}
    {modal?.type === 'form' && <Modal title={t(modal.edit ? 'care.editWeight' : 'care.addWeight')} onClose={() => { if (!pending.current) setModal(null); }}><form className="pet-form" onSubmit={save} aria-busy={busy}>
      <label htmlFor="weight-value">{t('care.weightKg')} *</label><input id="weight-value" type="number" step="0.001" min="0.001" max="2000" required autoFocus disabled={busy} value={modal.draft.kg} onChange={e => setModal({ ...modal, draft: { ...modal.draft, kg: e.target.value } })} />
      <label htmlFor="weight-date">{t('medical.date')} *</label><input id="weight-date" type="date" required min="1900-01-01" max={date} disabled={busy} value={modal.draft.date} onChange={e => setModal({ ...modal, draft: { ...modal.draft, date: e.target.value } })} />
      <label htmlFor="weight-notes">{t('medical.notes')}</label><textarea id="weight-notes" maxLength={1000} rows={3} disabled={busy} value={modal.draft.notes} onChange={e => setModal({ ...modal, draft: { ...modal.draft, notes: e.target.value } })} />
      {error && <p role="alert" className="form-error">{errorText(error)}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setModal(null)}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy ? 'account.saving' : 'account.save')}</button></div>
    </form></Modal>}
    {modal?.type === 'delete' && <Modal title={t('care.deleteWeight')} onClose={() => { if (!pending.current) setModal(null); }}><p>{t('care.deleteWeightText', { date: modal.record.date, weight: number(modal.record.kg) })}</p>{error && <p className="form-error" role="alert">{errorText(error)}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={remove}>{t('account.confirmDelete')}</button></div></Modal>}
  </section>;
}
