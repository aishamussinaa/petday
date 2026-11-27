import { useDeletionUndo } from './DeletionUndo.jsx';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from './ApiContext.jsx';
import { dayKey, localDay } from './careOverview.js';
import { formatDate } from '../dateUtils.js';
import { shiftDay } from '../../../shared/weekly.js';
import './weekly.css';

export default function WeeklyOverview({ pet, end, onEnd, onDay }) {
  const { revision } = useDeletionUndo();
  const request = useApi(), { t, i18n } = useTranslation();
  const [state, setState] = useState({ loading: true }), [retry, setRetry] = useState(0);
  const today = dayKey();
  useEffect(() => {
    let active = true; setState({ loading: true });
    request(`/pets/${pet.id}/tasks/weekly?end=${end}&timeZone=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`)
      .then(data => { if (active) setState({ data }); })
      .catch(() => { if (active) setState({ error: true }); });
    return () => { active = false; };
  }, [pet.id, end, retry, request, revision]);
  const date = value => formatDate(localDay(value), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const number = value => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(value);
  const { data } = state;
  return <section className="weekly-panel" aria-label={t('weekly.title')} aria-busy={Boolean(state.loading)}>
    <header className="weekly-header"><div><h3>{t('weekly.title')}</h3><p>{t('weekly.period', { start: date(shiftDay(end, -6)), end: date(end) })}</p></div><label>{t('weekly.end')}<input type="date" min="1900-01-07" max={today} value={end} onChange={event => { if (event.target.validity.valid && event.target.value) onEnd(event.target.value); }} /></label></header>
    <div className="weekly-controls"><button className="button secondary" disabled={end < '1900-01-14'} onClick={() => onEnd(shiftDay(end, -7))}>{t('weekly.previous')}</button><button className="button secondary" disabled={end >= today} onClick={() => onEnd(shiftDay(end, 7) > today ? today : shiftDay(end, 7))}>{t('weekly.next')}</button><button className="text-link" disabled={end === today} onClick={() => onEnd(today)}>{t('weekly.current')}</button></div>
    {state.loading ? <p role="status">{t('account.loading')}</p> : state.error ? <p role="alert">{t('weekly.error')} <button className="text-link" onClick={() => setRetry(value => value + 1)}>{t('account.retry')}</button></p> : data && <>
      <p className="weekly-hint">{t('weekly.hint')}</p>
      <div className="weekly-summary">
        <article><span>{t('weekly.steps')}</span><strong data-testid="week-steps">{data.done} / {data.target}</strong><p>{data.target ? t('weekly.percent', { value: Math.round(data.done / data.target * 100) }) : t('weekly.noPlan')}</p></article>
        <article><span>{t('weekly.walks')}</span><strong data-testid="week-walks">{data.walks} / {data.walkTarget}</strong><p>{t('weekly.walkHint')}</p></article>
        <article><span>{t('weekly.completeDays')}</span><strong data-testid="week-days">{data.completeDays} / {data.plannedDays}</strong><p>{t('weekly.daysHint')}</p></article>
        <article><span>{t('weekly.meals')}</span><strong data-testid="week-meals">{data.meals}</strong><p>{t('weekly.mealsHint')}</p></article>
      </div>
      <div className="weekly-chart"><h4>{t('weekly.byDay')}</h4><p className="small muted">{t('weekly.openDay')}</p><ol>{data.days.map(day => <li key={day.date}><button onClick={() => onDay(day.date)} aria-label={t('weekly.dayLabel', { date: date(day.date), done: day.done, total: day.target })}>
        <span className="weekly-day"><time dateTime={day.date}>{formatDate(localDay(day.date), i18n.language, { weekday: 'short' })}</time><span>{formatDate(localDay(day.date), i18n.language, { day: 'numeric', month: 'short' })}</span></span>
        <span className={`weekly-track ${day.allDone ? 'complete' : ''}`} aria-hidden="true"><span style={{ width: `${day.target ? day.done / day.target * 100 : 0}%` }} /></span><span className="weekly-count">{day.target ? `${day.done} / ${day.target}` : t('weekly.noPlan')}</span>
      </button></li>)}</ol></div>
      <div className="weekly-weight"><h4>{t('weekly.weight')}</h4>{data.weight.change === null ? <p>{t('weekly.weightMissing')}</p> : <><strong>{data.weight.change > 0 ? '+' : ''}{number(data.weight.change)} {t('care.kg')}</strong><p>{t('weekly.weightRange', { first: number(data.weight.first.kg), last: number(data.weight.last.kg), start: date(data.weight.first.date), end: date(data.weight.last.date) })}</p></>}<p className="small muted">{t('weekly.weightHint')}</p></div>
    </>}
  </section>;
}
