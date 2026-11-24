import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { formatDate, formatTime } from '../dateUtils.js';
import { request } from './api.js';
import './food.css';

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const localDay = value => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const kinds = ['dry', 'wet', 'home', 'treat', 'other'];
const units = ['g', 'ml', 'pcs'];
function ErrorNotice({ code }) {
  const { t } = useTranslation();
  return code ? <p className="form-error" role="alert">{t(`nutrition.errors.${code}`, { defaultValue: t(`account.errors.${code}`, { defaultValue: t('account.errors.INTERNAL_ERROR') }) })}</p> : null;
}
function MealForm({ meal, day, onClose, onSave }) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(() => meal ? { ...meal, amount: meal.amount ?? '' } : { id: crypto.randomUUID(), day, title: '', kind: 'dry', time: '', amount: '', unit: 'g', notes: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const pending = useRef(false);
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }));
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    if (!draft.title.trim()) { setError('MEAL_TITLE'); document.getElementById('meal-title')?.focus(); return; }
    pending.current = true; setBusy(true); setError(null);
    try { await onSave({ ...draft, amount: draft.amount === '' ? null : Number(draft.amount) }); onClose(); }
    catch (failure) { setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  return <Modal title={t(meal ? 'nutrition.edit' : 'nutrition.add')} onClose={() => { if (!pending.current) onClose(); }}><form className="pet-form feeding-form" onSubmit={submit} aria-busy={busy}>
    <p className="muted">{formatDate(localDay(draft.day), i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    <label htmlFor="meal-title">{t('nutrition.title')} *</label><input id="meal-title" autoFocus required maxLength={120} value={draft.title} disabled={busy} onChange={e => change('title', e.target.value)} />
    <div className="form-columns"><div><label htmlFor="meal-kind">{t('nutrition.kind')}</label><select id="meal-kind" disabled={busy} value={draft.kind} onChange={e => change('kind', e.target.value)}>{kinds.map(value => <option key={value} value={value}>{t(`nutrition.kinds.${value}`)}</option>)}</select></div><div><label htmlFor="meal-time">{t('nutrition.time')}</label><input id="meal-time" type="time" disabled={busy} value={draft.time} onChange={e => change('time', e.target.value)} /></div></div>
    <div className="form-columns"><div><label htmlFor="meal-amount">{t('nutrition.amount')}</label><input id="meal-amount" type="number" min="0.01" max="100000" step="0.01" disabled={busy} value={draft.amount} onChange={e => change('amount', e.target.value)} aria-describedby="meal-amount-hint" /></div><div><label htmlFor="meal-unit">{t('nutrition.unit')}</label><select id="meal-unit" disabled={busy} value={draft.unit} onChange={e => change('unit', e.target.value)}>{units.map(value => <option key={value} value={value}>{t(`nutrition.units.${value}`)}</option>)}</select></div></div>
    <p className="small muted" id="meal-amount-hint">{t('nutrition.amountHint')}</p>
    <label htmlFor="meal-notes">{t('nutrition.notes')}</label><textarea id="meal-notes" rows={3} maxLength={2000} disabled={busy} value={draft.notes} onChange={e => change('notes', e.target.value)} />
    <ErrorNotice code={error} /><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy ? 'account.saving' : 'account.save')}</button></div>
  </form></Modal>;
}

export default function Food({ pet, today }) {
  const { t, i18n } = useTranslation();
  const currentDay = dayKey(today);
  const [day, setDay] = useState(currentDay), [meals, setMeals] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(null);
  const [modal, setModal] = useState(null), [busy, setBusy] = useState(false);
  const generation = useRef(0), pending = useRef(false), previousToday = useRef(currentDay);
  const base = `/pets/${pet.id}/meals`;
  useEffect(() => { const previous = previousToday.current; previousToday.current = currentDay; setDay(value => value === previous ? currentDay : value); }, [currentDay]);
  async function load() {
    const current = ++generation.current; setLoading(true); setError(null);
    try { const data = await request(`${base}?date=${day}`); if (current === generation.current) setMeals(data.meals); }
    catch (failure) { if (current === generation.current) { setError(failure.code); setMeals([]); } }
    finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => { load(); return () => { generation.current++; }; }, [day, pet.id]);
  async function save(draft) {
    try {
      const result = await request(`${base}${modal.meal ? `/${draft.id}` : ''}`, { method: modal.meal ? 'PUT' : 'POST', body: { ...draft, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      // Ignore an old-day record if midnight advanced the open diary meanwhile.
      setMeals(previous => [...previous.filter(item => item.id !== result.meal.id), result.meal]);
      setError(null);
    } catch (failure) { if (['MEAL_CHANGED', 'MEAL_NOT_FOUND'].includes(failure.code)) await load(); throw failure; }
  }
  async function remove() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try { await request(`${base}/${modal.meal.id}`, { method: 'DELETE', body: { version: modal.meal.version } }); setMeals(previous => previous.filter(item => item.id !== modal.meal.id)); setModal(null); }
    catch (failure) { if (['MEAL_CHANGED', 'MEAL_NOT_FOUND'].includes(failure.code)) { setModal(null); await load(); } setError(failure.code); }
    finally { pending.current = false; setBusy(false); }
  }
  function shift(offset) { const next = localDay(day); next.setDate(next.getDate() + offset); const key = dayKey(next); if (key >= '1900-01-01' && key <= currentDay) setDay(key); }
  const records = meals.filter(meal => meal.day === day).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const totals = units.map(unit => ({ unit, amount: records.filter(meal => meal.unit === unit && meal.amount !== null).reduce((sum, meal) => sum + Math.round(meal.amount * 100), 0) / 100 })).filter(total => total.amount > 0);
  const amountText = (amount, unit) => `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(amount)} ${t(`nutrition.units.${unit}`)}`;
  return <section className="feeding-panel" aria-label={t('nutrition.heading', { name: pet.name })}>
    <header className="feeding-heading"><div><p className="eyebrow">{t('nutrition.eyebrow')}</p><h2>{t('nutrition.heading', { name: pet.name })}</h2><p className="muted">{t('nutrition.intro')}</p></div><button className="button primary" disabled={loading || Boolean(error) || day > currentDay} onClick={() => setModal({ type: 'form' })}><Icon name="plus" />{t('nutrition.add')}</button></header>
    {pet.allergies && <aside className="feeding-allergies"><strong>{t('account.allergies')}</strong><p>{pet.allergies}</p></aside>}
    <div className="feeding-dates"><button className="button secondary" aria-label={t('today.previous')} disabled={loading || day <= '1900-01-01'} onClick={() => shift(-1)}>←</button><label htmlFor="feeding-day">{t('nutrition.date')}</label><input id="feeding-day" type="date" min="1900-01-01" max={currentDay} value={day} onChange={e => { if (e.target.validity.valid && e.target.value) setDay(e.target.value); }} /><button className="button secondary" aria-label={t('today.next')} disabled={loading || day >= currentDay} onClick={() => shift(1)}>→</button><button className="button secondary" onClick={() => setDay(currentDay)}>{t('nav.today')}</button></div>
    <ErrorNotice code={error} />{error && <button className="button secondary" onClick={load}>{t('account.retry')}</button>}
    {loading ? <p role="status">{t('account.loading')}</p> : !error && <>
      <div className="feeding-summary"><div><span>{t('nutrition.entries')}</span><strong>{records.length}</strong></div><div><span>{t('nutrition.total')}</span><strong>{totals.length ? totals.map(value => amountText(value.amount, value.unit)).join(' · ') : '—'}</strong><p className="small">{t('nutrition.totalHint')}</p></div></div>
      {!records.length ? <div className="feeding-empty"><Icon name="food" size={48} /><h3>{t('nutrition.empty')}</h3><p>{t('nutrition.emptyText')}</p></div> : <ul className="feeding-list">{records.map(meal => <li key={meal.id} className="feeding-entry"><div className="feeding-entry-top"><span className="feeding-kind">{t(`nutrition.kinds.${meal.kind}`)}</span><span className="feeding-time">{meal.time ? <time dateTime={`${meal.day}T${meal.time}`}>{formatTime(meal.time, i18n.language)}</time> : t('nutrition.noTime')}</span></div><h3>{meal.title}</h3><p className="feeding-amount">{meal.amount === null ? t('nutrition.unknownAmount') : amountText(meal.amount, meal.unit)}</p>{meal.notes && <p className="feeding-notes">{meal.notes}</p>}<div className="feeding-actions"><button className="button secondary" onClick={() => setModal({ type: 'form', meal })}>{t('account.edit')}</button><button className="feeding-remove" onClick={() => { setError(null); setModal({ type: 'delete', meal }); }}>{t('account.confirmDelete')}</button></div></li>)}</ul>}
    </>}
    {modal?.type === 'form' && <MealForm meal={modal.meal} day={day} onClose={() => setModal(null)} onSave={save} />}
    {modal?.type === 'delete' && <Modal title={t('nutrition.deleteTitle')} onClose={() => { if (!pending.current) setModal(null); }}><p className="delete-explanation">{t('nutrition.deleteText', { title: modal.meal.title })}</p><ErrorNotice code={error} /><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={remove}>{t(busy ? 'account.wait' : 'account.confirmDelete')}</button></div></Modal>}
  </section>;
}
