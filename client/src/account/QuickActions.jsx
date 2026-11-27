import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import { useApi } from './ApiContext.jsx';
import { dayKey } from './careOverview.js';
import './quickActions.css';

export default function QuickActions({ pet, day, tasks, disabled, refreshTasks, refreshMeals }) {
  const request = useApi();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [weight, setWeight] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const retry = useRef({});
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // The daily list is already ordered by scheduled time.
  const walk = tasks.find(task => task.category === 'walk' && task.completedCount < task.targetCount);
  function makeOperation(kind) {
    const base = '/pets/' + pet.id;
    const now = new Date();
    const time = [now.getHours(), now.getMinutes()].map(n => String(n).padStart(2, '0')).join(':');
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (kind === 'walk' && walk) {
      return { path: base + '/tasks/' + walk.id + '/count', method: 'PATCH', body: { delta: 1, version: walk.version, timeZone } };
    }
    const id = crypto.randomUUID();
    if (kind === 'walk') {
      return { path: base + '/tasks', method: 'POST', body: { id, day, category: 'walk', title: t('today.categories.walk'), notes: '', time, targetCount: 1, logCompletedWalk: true, timeZone } };
    }
    if (kind === 'meal') {
      return { path: base + '/meals', method: 'POST', body: { id, day, title: t('quick.mealName'), kind: 'other', amount: null, unit: 'g', notes: '', time, timeZone } };
    }
    return { path: base + '/weights', method: 'POST', body: { id, date: day, kg: Number(weight), notes: '', timeZone } };
  }

  async function record(kind) {
    if (pending.current || day !== dayKey()) return;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    // Reuse the original body after a lost response, including its ID, time and task version.
    const op = retry.current[kind] || makeOperation(kind);
    try {
      await request(op.path, { method: op.method, body: op.body });
      delete retry.current[kind];
      if (!alive.current) return;
      if (kind === 'weight') setWeight(null);
      setMessage('quick.' + kind + 'Saved');
      if (kind === 'walk') await refreshTasks();
      if (kind === 'meal') refreshMeals();
    } catch (failure) {
      if (!alive.current) return;
      if (failure.code === 'NETWORK_ERROR') retry.current[kind] = op;
      else delete retry.current[kind];
      if (failure.code === 'TASK_CHANGED' || failure.code === 'TASK_NOT_FOUND') await refreshTasks();
      setError(failure.code || 'INTERNAL_ERROR');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const errorText = error && t(['today.errors.' + error, 'care.errors.' + error, 'nutrition.errors.' + error, 'account.errors.' + error, 'account.errors.INTERNAL_ERROR']);
  return <section className="quick-actions" aria-label={t('quick.heading')}>
    <h3>{t('quick.heading')}</h3>
    <div className="quick-buttons">
      <button className="button secondary" disabled={busy || disabled} onClick={() => record('walk')}><Icon name="walk"/>{t('quick.walk')}</button>
      <button className="button secondary" disabled={busy} onClick={() => record('meal')}><Icon name="food"/>{t('quick.meal')}</button>
      <button className="button secondary" disabled={busy} onClick={() => { setError(''); setMessage(''); setWeight(retry.current.weight?.body.kg?.toString() || ''); }}><Icon name="plus"/>{t('care.addWeight')}</button>
    </div>
    {message && <p role="status">{t(message)}</p>}
    {error && weight === null && <p className="form-error" role="alert">{errorText}</p>}
    {weight !== null && <Modal title={t('care.addWeight')} onClose={() => { if (!pending.current) { setWeight(null); setError(''); } }}>
      <form className="pet-form" onSubmit={event => { event.preventDefault(); record('weight'); }}>
        <label htmlFor="quick-kg">{t('care.weightKg')} · {pet.name}</label>
        <input id="quick-kg" type="number" required autoFocus min="0.001" max="2000" step="0.001" value={weight} disabled={busy} onChange={event => { setWeight(event.target.value); if (retry.current.weight && Number(event.target.value) !== retry.current.weight.body.kg) delete retry.current.weight; }} />
        {error && <p className="form-error" role="alert">{errorText}</p>}
        <div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => { setWeight(null); setError(''); }}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t('account.save')}</button></div>
      </form>
    </Modal>}
  </section>;
}
