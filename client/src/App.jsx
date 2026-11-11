import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { categories } from './data/demo.js';
import { useDemo } from './data/DemoContext.jsx';
import { RouteLink } from './routing.jsx';
import { dateOnly, dayDistance, nextBirthday, formatAge, formatDate, formatTime } from './dateUtils.js';
import Icon from './components/Icon.jsx';
import Brand from './components/Brand.jsx';
import LanguageSwitch from './components/LanguageSwitch.jsx';
import Modal from './components/Modal.jsx';
import Diagnostics from './components/Diagnostics.jsx';

const sections = ['today', 'pets', 'food', 'health'];
const emptyDraft = { title: '', time: '12:00', category: 'other' };
const actualTime = (date, locale) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(date));

function Navigation({ current, onChange, mobile = false }) {
  const { t } = useTranslation();
  return <nav className={mobile ? 'bottom-nav' : 'side-nav'} aria-label={t('navigation')}>
    {sections.map(section => <button key={section} onClick={() => onChange(section)} aria-current={current === section ? 'page' : undefined}><Icon name={section} /><span>{t(`nav.${section}`)}</span>{!mobile && current === section && <span className="nav-dot" />}</button>)}
  </nav>;
}

function PetCard({ pet, today, onProfile, compact = false }) {
  const { t, i18n } = useTranslation();
  const birthday = pet.birth ? nextBirthday(pet.birth, today) : null;
  return <article className={`pet-card pet-${pet.species} ${compact ? 'compact' : ''}`}>
    <div className="pet-photo"><img src={pet.image} alt={t('photoAlt', { name: pet.name })} /><span className="photo-tag"><Icon name="paw" size={15} />{t('demoPet')}</span></div>
    <div className="pet-card-content"><div className="pet-name-row"><div><h2>{pet.name}</h2><p className="muted">{t(`species.${pet.species}`)} · {t(`breeds.${pet.breed}`)}</p></div><span className="pet-symbol"><Icon name="paw" /></span></div>
      <div className="pet-facts"><div><span>{t('age')}</span><strong>{pet.birth ? formatAge(pet.birth, today, i18n.language) : t('notSpecified')}</strong></div><div><span>{t('untilBirthday')}</span><strong>{birthday ? t('days', { count: dayDistance(today, birthday) }) : t('notSpecified')}</strong></div></div>
      <button className="profile-link" onClick={() => onProfile(pet)}>{t('viewProfile')}<Icon name="arrow" size={19} /></button>
    </div>
  </article>;
}

function Upcoming({ pet, today }) {
  const { t, i18n } = useTranslation();
  const events = [{ type: 'vet', icon: 'health', date: pet.vetDate }, ...(pet.birth ? [{ type: 'birthday', icon: 'gift', date: nextBirthday(pet.birth, today) }] : [])].sort((a, b) => a.date - b.date);
  return <section className="upcoming"><div className="section-heading"><h2>{t('upcoming')}</h2><span className="muted small">{t('demoEvents')}</span></div>
    {events.map(event => <div className="event" key={event.type}><span className={`category-icon ${event.type}`}><Icon name={event.icon} /></span><div><h3>{t(`events.${event.type}`)}</h3><p>{formatDate(event.date, i18n.language)}<span className="dot-separator">·</span>{t('inDays', { count: dayDistance(today, event.date) })}</p></div></div>)}
    <p className="event-note">{t('eventNote')}</p>
  </section>;
}

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

function Feeding({ tasks, pet }) {
  const { t, i18n } = useTranslation();
  const meals = tasks.filter(task => task.category === 'food').sort((a, b) => a.time.localeCompare(b.time));
  return <section className="panel records"><div className="section-heading"><div><h2>{t('feedingJournal')}</h2><p className="muted">{t('feedingIntro', { name: pet.name })}</p></div><span className="category-icon food"><Icon name="food" /></span></div>
    <div className="journal-labels"><span>{t('meal')}</span><span>{t('planned')}</span><span>{t('actual')}</span></div>
    {meals.map(task => <div className="journal-row" key={task.id}><div><strong>{task.title ?? t(`tasks.${task.titleKey}`)}</strong><p className="muted small">{t('demoMeal')}</p></div><time>{formatTime(task.time, i18n.language)}</time><span className={`meal-status ${task.done ? 'completed' : ''}`}>{task.done ? actualTime(task.completedAt, i18n.language) : t('pending')}</span></div>)}
    <p className="record-note">{t('feedingNote')}</p>
  </section>;
}

function Health({ pet }) {
  const { t, i18n } = useTranslation();
  return <section className="panel records"><div className="section-heading"><div><h2>{t('healthJournal')}</h2><p className="muted">{t('healthIntro', { name: pet.name })}</p></div><span className="category-icon vet"><Icon name="health" /></span></div>
    <div className="health-record"><span className="record-date">{formatDate(pet.vetDate, i18n.language)}</span><div><span className="tag lavender">{t('planned')}</span><h3>{t('events.vet')}</h3><p>{t('visitPlanned')}</p></div></div>
    <div className="health-record"><span className="record-date">{formatDate(pet.visitDate, i18n.language)}</span><div><span className="tag">{t('recorded')}</span><h3>{t('previousVisit')}</h3><p>{t('visitNote')}</p></div></div>
    <p className="record-note">{t('healthNote')}</p>
  </section>;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const { demo, tasks, setTasks, selected, setSelected } = useDemo();
  const [section, setSection] = useState('today');
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [today, setToday] = useState(() => dateOnly(new Date()));
  useEffect(() => { const timer = setInterval(() => setToday(dateOnly(new Date())), 60000); return () => clearInterval(timer); }, []);
  const pet = demo.pets.find(item => item.id === selected);
  const currentTasks = tasks[selected];
  function toggle(id) {
    setTasks(previous => ({ ...previous, [selected]: previous[selected].map(task => task.id === id ? { ...task, done: !task.done, completedAt: task.done ? null : new Date().toISOString() } : task) }));
  }
  function addTask(event) {
    event.preventDefault();
    if (!draft.title.trim()) { setError('titleRequired'); document.getElementById('task-title').focus(); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) { setError('timeRequired'); return; }
    const task = { ...draft, title: draft.title.trim(), id: crypto.randomUUID(), done: false, completedAt: null };
    setTasks(previous => ({ ...previous, [selected]: [...previous[selected], task] }));
    setDraft(emptyDraft); setError(''); setModal(null);
  }
  const openProfile = item => setModal({ type: 'profile', pet: item });
  return <div className="app-layout pastel-app">
    <aside className="sidebar"><RouteLink className="brand" href="/" aria-label={t('landing.home')}><Brand /></RouteLink><p className="sidebar-caption">{t('yourCareSpace')}</p><Navigation current={section} onChange={setSection} /><div className="sidebar-bottom"><div className="sidebar-note"><Icon name="paw" size={30} /><p>{t('sidebarNote')}</p><span>{t('sidebarSubnote')}</span></div><LanguageSwitch /><span className="demo-badge"><span />{t('demo')}</span></div></aside>
    <div className="workspace"><header className="mobile-header"><RouteLink className="brand" href="/" aria-label={t('landing.home')}><Brand /></RouteLink><LanguageSwitch /></header>
      <main id="main" tabIndex={-1}><header className="page-header"><div><p className="date-line">{formatDate(today, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}<span className="header-dot" />PetDay</p><h1>{section === 'today' ? t('dashboardHeading') : t(`nav.${section}`)}</h1><p className="page-subtitle">{t(`intro.${section}`)}</p></div><span className="header-symbol"><Icon name={section === 'today' ? 'sun' : section} size={29} /></span></header>
      <div className="demo-notice"><span className="demo-badge"><span />{t('demo')}</span><p>{t('demoNotice')}</p></div>
      <div className="pet-selector" role="group" aria-label={t('selectPet')}>{demo.pets.map(item => <button key={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><img className={`avatar-${item.species}`} src={item.image} alt="" /><span>{item.name}<small>{t(`species.${item.species}`)}</small></span>{selected === item.id && <span className="selected-check"><Icon name="check" size={14} /></span>}</button>)}</div>
      {section === 'today' ? <div className="dashboard-grid"><div className="main-column"><Progress tasks={currentTasks} pet={pet} /><Schedule tasks={currentTasks} onToggle={toggle} onAdd={() => { setError(''); setModal({ type: 'task' }); }} /><div className="care-message"><span className="category-icon care"><Icon name="paw" /></span><div><strong>{t('careMessage')}</strong><p>{t('careMessageText')}</p></div></div></div><div className="right-column"><PetCard pet={pet} today={today} onProfile={openProfile} /><Upcoming pet={pet} today={today} /></div></div> : section === 'pets' ? <section className="pets-grid" aria-label={t('nav.pets')}>{demo.pets.map(item => <PetCard key={item.id} pet={item} today={today} onProfile={openProfile} compact />)}</section> : <div className="dashboard-grid"><div className="main-column">{section === 'food' ? <Feeding tasks={currentTasks} pet={pet} /> : <Health pet={pet} />}</div><div className="right-column"><PetCard pet={pet} today={today} onProfile={openProfile} /><Upcoming pet={pet} today={today} /></div></div>}
      {import.meta.env.DEV && <Diagnostics />}
      <footer className="page-footer"><RouteLink href="/">{t('landing.backHome')}</RouteLink><span>{t('footer')}</span><Icon name="paw" size={16} /></footer>
      </main>
    </div><Navigation current={section} onChange={setSection} mobile />
    {modal?.type === 'task' && <Modal title={t('addTask')} onClose={() => setModal(null)}><p className="muted modal-description">{t('taskFor', { name: pet.name })}</p><form onSubmit={addTask} noValidate><label htmlFor="task-title">{t('taskName')}</label><input id="task-title" autoFocus maxLength={100} value={draft.title} aria-invalid={error === 'titleRequired'} aria-describedby={error === 'titleRequired' ? 'form-error' : undefined} onChange={event => { setDraft({ ...draft, title: event.target.value }); setError(''); }} placeholder={t('taskPlaceholder')} /><div className="form-columns"><div><label htmlFor="task-time">{t('time')}</label><input id="task-time" type="time" required value={draft.time} aria-invalid={error === 'timeRequired'} onChange={event => setDraft({ ...draft, time: event.target.value })} /></div><div><label htmlFor="task-category">{t('category')}</label><select id="task-category" value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}</select></div></div>{error && <p id="form-error" role="alert" className="form-error">{t(error)}</p>}<p className="small muted">{t('formNote')}</p><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setModal(null)}>{t('cancel')}</button><button className="button primary" type="submit"><Icon name="plus" size={18} />{t('saveTask')}</button></div></form></Modal>}
    {modal?.type === 'profile' && <Modal title={modal.pet.name} onClose={() => setModal(null)}><img className={`profile-modal-photo pet-${modal.pet.species}`} src={modal.pet.image} alt={t('photoAlt', { name: modal.pet.name })} /><span className="tag profile-demo">{t('demoPet')}</span><dl className="profile-details"><div><dt>{t('speciesLabel')}</dt><dd>{t(`species.${modal.pet.species}`)}</dd></div><div><dt>{t('breedLabel')}</dt><dd>{t(`breeds.${modal.pet.breed}`)}</dd></div><div><dt>{t('birthDate')}</dt><dd>{modal.pet.birth ? formatDate(modal.pet.birth, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) : t('notSpecified')}</dd></div><div><dt>{t('age')}</dt><dd>{modal.pet.birth ? formatAge(modal.pet.birth, today, i18n.language, true) : t('notSpecified')}</dd></div></dl><div className="profile-note"><strong>{t('notes')}</strong><p>{t(modal.pet.note)}</p></div><p className="small muted">{t('demoNotice')}</p></Modal>}
  </div>;
}
