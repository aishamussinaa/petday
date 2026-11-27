import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from './ApiContext.jsx';
import { dayKey, localDay } from './careOverview.js';
import { formatDate } from '../dateUtils.js';
import { monthEvents } from './events.js';
import Icon from '../components/Icon.jsx';
import './event-calendar.css';

export default function EventCalendar({ pets, today, onOpen }) {
  const { t, i18n } = useTranslation();
  const request = useApi();
  const [month, setMonth] = useState(() => dayKey(today).slice(0, 7));
  const [day, setDay] = useState('');
  const [petId, setPetId] = useState('');
  const [load, setLoad] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoad(null);
    Promise.allSettled(pets.map(pet => request('/pets/' + pet.id + '/health'))).then(results => {
      if (!active) return;
      const journals = {}, missing = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') journals[pets[index].id] = result.value.records;
        else missing.push(pets[index].name);
      });
      setLoad({ journals, missing });
    });
    return () => { active = false; };
  }, [request, pets, attempt]);

  function showMonth(value) { setMonth(value); setDay(''); }
  const first = localDay(month + '-01');
  const year = first.getFullYear(), index = first.getMonth();
  const offsetMonth = offset => dayKey(new Date(year, index + offset, 1, 12)).slice(0, 7);
  const calendarDays = Array.from({ length: new Date(year, index + 1, 0).getDate() }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'));
  const events = monthEvents(month, pets.filter(p => !petId || p.id === petId), load?.journals || {});
  const agenda = day ? events.filter(event => event.date === day) : events;
  const label = event => t(event.kind === 'birthday' ? 'party.label' : 'medical.' + event.kind);
  const currentMonth = dayKey(today).slice(0, 7);
  const monthLabel = formatDate(first, i18n.language, { month: 'long', year: 'numeric' });

  return <section className="event-calendar" aria-labelledby="events-title">
    <header className="events-head"><h2 id="events-title">{t('eventsView.title')}</h2>
      <label>{t('nav.pets')}<select value={petId} onChange={e => { setPetId(e.target.value); setDay(''); }}>
        <option value="">{t('eventsView.allPets')}</option>{pets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select></label>
    </header>
    <div className="events-layout"><section className="events-month">
      <div className="events-month-heading"><h3 aria-live="polite">{monthLabel}</h3><button className="text-link" onClick={() => showMonth(currentMonth)}>{t('eventsView.current')}</button></div>
      <div className="events-controls"><button disabled={month <= '1900-01'} onClick={() => showMonth(offsetMonth(-1))}>{t('eventsView.prev')}</button>
        <button disabled={month >= '2100-12'} onClick={() => showMonth(offsetMonth(1))}>{t('eventsView.next')}</button></div>
      <div className="events-grid">{[1,2,3,4,5,6,0].map(n => <span className="events-weekday" key={n}>{t('today.weekdays.' + n)}</span>)}
        {calendarDays.map((key, i) => {
          const onDate = events.filter(e => e.date === key);
          const dateLabel = formatDate(localDay(key), i18n.language);
          return <button key={key} style={i === 0 ? { gridColumnStart: (first.getDay() + 6) % 7 + 1 } : undefined}
            aria-pressed={day === key} aria-current={key === dayKey(today) ? 'date' : undefined}
            aria-label={t('eventsView.dayLabel', { date: dateLabel, count: onDate.length })}
            onClick={() => setDay(day === key ? '' : key)}>
            {i + 1}<span className="events-dots" aria-hidden="true">{[...new Set(onDate.map(e => e.kind))].map(kind => <i key={kind} className={'dot-' + kind} />)}</span>
          </button>;
        })}
      </div>
    </section>
    <section className="events-agenda" aria-labelledby="agenda-title">
      <div className="events-month-heading"><h3 id="agenda-title">{day ? formatDate(localDay(day), i18n.language) : t('eventsView.agenda')}</h3>
        {day && <button className="text-link" onClick={() => setDay('')}>{t('eventsView.allDays')}</button>}</div>
      {!load && <p role="status">{t('account.loading')}</p>}
      {!!load?.missing.length && <p role="alert">{t('eventsView.error', { pets: load.missing.join(', ') })} <button className="text-link" onClick={() => setAttempt(attempt + 1)}>{t('account.retry')}</button></p>}
      {load && !load.missing.length && !agenda.length && <p>{t(day ? 'eventsView.emptyDay' : 'eventsView.emptyMonth')}</p>}
      <ul>{agenda.map(event => <li key={event.key}>
        <span className={'events-symbol symbol-' + event.kind}><Icon name={event.kind === 'birthday' ? 'gift' : 'health'} /></span>
        <div><time dateTime={event.date}>{formatDate(localDay(event.date), i18n.language)}</time>
          <button className="event-entry" onClick={() => onOpen(event)}>{event.record?.title || label(event)} · {event.pet.name}</button>
          <small>{event.record ? label(event) + ' · ' + t(event.followUp ? 'medical.nextDate' : 'medical.' + event.record.status) : t(event.pet.birthApproximate ? 'party.approximate' : 'viewProfile')}</small>
        </div></li>)}</ul>
    </section></div>
  </section>;
}
