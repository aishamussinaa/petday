import { useTranslation } from 'react-i18next';
import { formatTime } from './dateUtils.js';
import Icon from './components/Icon.jsx';
const actualTime = (date, locale) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(date));

export function Schedule({ tasks, onToggle, onAdd, addLabel }) {
  const { t, i18n } = useTranslation();
  return <section className="schedule panel"><div className="section-heading"><div><h2>{t('schedule')}</h2><p className="muted small">{t('scheduleHint')}</p></div><button className="button secondary add-button" onClick={onAdd}><Icon name={addLabel ? 'arrow' : 'plus'} size={18} /><span>{addLabel || t('addTask')}</span></button></div>
    <ul className="task-list">{[...tasks].sort((a, b) => a.time.localeCompare(b.time)).map(task => {
      const title = task.title ?? t(`tasks.${task.titleKey}`);
      return <li className={`task-row ${task.done ? 'is-done' : ''}`} key={task.id}>
        <time className="task-time">{formatTime(task.time, i18n.language)}</time>
        <span className={`category-icon ${task.category}`}><Icon name={task.category} size={21} /></span>
        <div className="task-description"><span className="task-title">{title}</span><span className="task-meta">{task.done ? t('completedAt', { time: actualTime(task.completedAt, i18n.language) }) : t(`categories.${task.category}`)}</span></div>
        <label className="task-check"><input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} aria-label={t('taskToggle', { title })} /><span><Icon name="check" size={17} /></span></label>
      </li>;
    })}</ul>
    <div className="schedule-footer"><Icon name="paw" size={17} /><span>{t('smallCare')}</span></div>
  </section>;
}

export function Progress({ tasks, pet }) {
  const { t, i18n } = useTranslation();
  const done = tasks.filter(task => task.done).length;
  const percent = Math.round(done / tasks.length * 100);
  return <section className="progress-card" aria-label={t('progressLabel')}>
    <div className="progress-copy"><span className="eyebrow">{t('dailyRhythm')}</span><h2>{done === tasks.length ? t('allDone') : t('goodStart')}</h2><p>{t('progressText', { name: pet.name })}</p></div>
    <div className="progress-stats"><div className="progress-count"><strong>{new Intl.NumberFormat(i18n.language).format(done)}</strong><span>/ {new Intl.NumberFormat(i18n.language).format(tasks.length)}</span><span className="progress-caption">{t('done')}</span></div><div className="progress-track" role="progressbar" aria-label={t('progressLabel')} aria-valuenow={done} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuetext={t('progressCount', { done, total: tasks.length })}><span style={{ width: `${percent}%` }} /></div></div>
    <span className="progress-decoration" aria-hidden="true"><Icon name="sun" size={92} /></span>
  </section>;
}
