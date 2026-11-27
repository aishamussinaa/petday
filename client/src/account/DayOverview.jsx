import { useDeletionUndo } from './DeletionUndo.jsx';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from './ApiContext.jsx';
import { dayKey, localDay, healthReminders } from './careOverview.js';
import { formatDate } from '../dateUtils.js';
import './care.css';

export default function DayOverview({ pet, day, tasks, onNavigate, demoData }) {
  const { revision } = useDeletionUndo();
  const request = useApi();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null), [retry, setRetry] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const tick = () => setNow(new Date()); const timer = setInterval(tick, 30000); document.addEventListener('visibilitychange', tick); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); }; }, []);
  useEffect(() => {
    if (demoData) { setData(demoData); return; }
    let active = true; setData(null);
    Promise.allSettled([request(`/pets/${pet.id}/health`), request(`/pets/${pet.id}/meals?date=${day}`)]).then(([health, food]) => {
      if (active) setData({ records: health.status === 'fulfilled' ? health.value.records : null, meals: food.status === 'fulfilled' ? food.value.meals : null });
    });
    return () => { active = false; };
  }, [pet.id, day, retry, demoData, revision]);
  if (day !== dayKey(now)) return null;
  const done = tasks.reduce((sum, item) => sum + item.completedCount, 0), total = tasks.reduce((sum, item) => sum + item.targetCount, 0);
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const due = tasks.filter(item => item.completedCount < item.targetCount && item.time && item.time <= clock);
  const reminders = healthReminders(data?.records || [], day);
  return <section className="day-overview" aria-label={t('care.overview')}>
    <div className="care-summary"><article><span>{t('care.dayProgress')}</span><strong>{done} / {total}</strong><p>{t(total && done === total ? 'care.allDone' : 'care.steps')}</p></article><article><span>{t('care.meals')}</span><strong>{!data ? '…' : data.meals ? data.meals.length : '—'}</strong><button className="text-link" onClick={() => onNavigate('food')}>{t('care.openFood')}</button></article><article><span>{t('care.nearHealth')}</span><strong>{!data ? '…' : data.records ? reminders.length : '—'}</strong><button className="text-link" onClick={() => onNavigate('health')}>{t('care.openHealth')}</button></article></div>
    <div className="care-reminders"><h3>{t('care.reminders')}</h3><p className="small muted">{t('care.remindersHint')}</p>
      {!data ? <p role="status">{t('account.loading')}</p> : <>
        {(data.records === null || data.meals === null) && <p role="alert">{t('care.partialError')} <button className="text-link" onClick={() => setRetry(value => value + 1)}>{t('account.retry')}</button></p>}
        {!reminders.length && !due.length && data.records !== null && <p>{t('care.nothingDue')}</p>}
        <ul>{due.map(task => <li key={task.id}><span className="care-dot" aria-hidden="true" /><div><strong>{task.title}</strong><p>{task.time} · {task.completedCount} / {task.targetCount}</p></div></li>)}{reminders.map(record => <li key={record.key}><span className="care-dot health" aria-hidden="true" /><div><strong>{record.title}</strong><p>{record.followUp ? `${t('care.followUp')} · ` : ''}{record.days < 0 ? t('care.overdue') : record.days === 0 ? t('care.dueToday') : record.days === 1 ? t('care.tomorrow') : t('care.inDays', { count: record.days })} · {formatDate(localDay(record.due), i18n.language)}</p></div><button className="button secondary" onClick={() => onNavigate('health')}>{t('care.details')}</button></li>)}</ul>
      </>}
    </div>
  </section>;
}
