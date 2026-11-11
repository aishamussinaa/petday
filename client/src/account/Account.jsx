import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Brand from '../components/Brand.jsx';
import Icon from '../components/Icon.jsx';
import LanguageSwitch from '../components/LanguageSwitch.jsx';
import Modal from '../components/Modal.jsx';
import { RouteLink, useRoute } from '../routing.jsx';
import { calendarAge, dayDistance, nextBirthday, dateOnly, formatDate } from '../dateUtils.js';
import { request, restoreSession } from './api.js';
import PetForm, { ErrorMessage } from './PetForm.jsx';

export const localBirth = value => { const [y, m, d] = value.split('-').map(Number); return new Date(y, m - 1, d, 12); };
function BirthDetails({ pet }) {
  const { t, i18n } = useTranslation();
  if (!pet.birthDate) return <p className="muted">{t('account.birthUnknown')}</p>;
  const birth = localBirth(pet.birthDate), today = dateOnly(new Date());
  const age = calendarAge(birth, today);
  const days = dayDistance(today, nextBirthday(birth, today));
  const ageText = [['year', age.years], ['month', age.months], ['day', age.days]].filter(([, count]) => count > 0).map(([unit, count]) => t(`account.${unit}`, { count })).join(', ') || t('account.day', { count: 0 });
  return <div className="real-birth"><p>{t('age')}: {pet.birthApproximate ? t('account.approximateValue', { value: ageText }) : ageText}</p><p>{pet.birthApproximate ? t('account.approximateValue', { value: days ? t('inDays', { count: days }) : t('account.birthdayToday') }) : days ? t('account.nextBirthday', { days: t('days', { count: days }) }) : t('account.birthdayToday')}</p><span className="small muted">{formatDate(birth, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}{pet.birthApproximate ? ` · ${t('account.approximateDate')}` : ''}</span></div>;
}
function Photo({ pet, className = '' }) {
  const { t } = useTranslation();
  return pet.photoUrl ? <img className={`real-photo ${className}`} src={pet.photoUrl} alt={t('account.petPhoto', { name: pet.name })} /> : <div className={`photo-placeholder ${className}`} aria-label={t('account.noPhoto')}><Icon name="paw" size={64} /></div>;
}
function Authentication({ onUser, initialError, retry }) {
  const { t } = useTranslation();
  const { path, navigate } = useRoute();
  const register = path === '/register';
  const [draft, setDraft] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pending = useRef(false);
  async function submit(event) {
    event.preventDefault(); if (pending.current) return;
    const fields = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) fields.email = 'INVALID_EMAIL';
    if (draft.password.length < 12 || draft.password.length > 128) fields.password = 'INVALID_PASSWORD';
    if (Object.keys(fields).length) { setError({ fields }); document.getElementById(`auth-${Object.keys(fields)[0]}`)?.focus(); return; }
    pending.current = true; setBusy(true); setError(null);
    try { await restoreSession(); const data = await request(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: draft }); onUser(data.user); navigate('/app'); }
    catch (failure) { setError(failure); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className="auth-card"><span className="eyebrow">{t('account.personalSpace')}</span><h1>{t(register ? 'account.register' : 'account.login')}</h1><p className="muted">{t(register ? 'account.registerIntro' : 'account.loginIntro')}</p>
    <form onSubmit={submit} noValidate aria-busy={busy}>{['email', 'password'].map(key => <div className="auth-field" key={key}><label htmlFor={`auth-${key}`}>{t(`account.${key}`)}</label><input id={`auth-${key}`} type={key} autoComplete={key === 'email' ? 'email' : register ? 'new-password' : 'current-password'} maxLength={key === 'email' ? 254 : 128} disabled={busy} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} aria-invalid={Boolean(error?.fields?.[key])} aria-describedby={key === 'password' ? 'password-hint auth-error-password' : 'auth-error-email'} /><div id={`auth-error-${key}`}><ErrorMessage error={error?.fields?.[key]} /></div></div>)}<p id="password-hint" className="small muted">{t('account.passwordHint')}</p><ErrorMessage error={error?.code === 'VALIDATION_ERROR' ? null : error?.code || initialError} /><button className="button primary auth-submit" type="submit" disabled={busy}>{t(busy ? 'account.wait' : register ? 'account.register' : 'account.login')}</button></form>
    {initialError && <button className="button secondary" onClick={retry}>{t('account.retry')}</button>}
    <p className="auth-switch">{t(register ? 'account.haveAccount' : 'account.noAccount')} <RouteLink href={register ? '/login' : '/register'}>{t(register ? 'account.login' : 'account.register')}</RouteLink></p><RouteLink className="text-link" href="/demo">{t('landing.openDemo')}<Icon name="arrow" size={18} /></RouteLink>
  </section>;
}

export default function Account() {
  const { t, i18n } = useTranslation();
  const { navigate } = useRoute();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pets, setPets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [section, setSection] = useState('pets');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const pet = pets.find(item => item.id === selected) || pets[0];
  async function load() {
    setLoading(true); setError(null);
    try { const data = await restoreSession(); setUser(data.user); if (data.user) { const result = await request('/pets'); setPets(result.pets); } }
    catch (failure) { setError(failure.code); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function loggedIn(value) {
    setUser(value); setPets([]); setError(null); setLoading(true);
    try { const result = await request('/pets'); setPets(result.pets); } catch (failure) { setError(failure.code); } finally { setLoading(false); }
  }
  async function logout() {
    if (actionPending.current) return; actionPending.current = true; setBusy(true); setError(null);
    try { await request('/auth/logout', { method: 'POST' }); setUser(null); setPets([]); setSelected(null); setModal(null); navigate('/login'); }
    catch (failure) { setError(failure.code); }
    finally { actionPending.current = false; setBusy(false); }
  }
  function saved(value) { setPets(previous => previous.some(item => item.id === value.id) ? previous.map(item => item.id === value.id ? value : item) : [...previous, value]); setSelected(value.id); setModal(null); setError(null); }
  async function remove() {
    if (actionPending.current) return; actionPending.current = true; setBusy(true); setError(null);
    try { await request(`/pets/${modal.pet.id}`, { method: 'DELETE', body: { version: modal.pet.version } }); setPets(previous => previous.filter(item => item.id !== modal.pet.id)); setSelected(null); setModal(null); }
    catch (failure) { setError(failure.code); }
    finally { actionPending.current = false; setBusy(false); }
  }
  return <div className="account-page"><header className="account-header"><RouteLink className="brand" href="/" aria-label={t('landing.home')}><Brand /></RouteLink><LanguageSwitch /><RouteLink href="/demo" className="account-demo-link">{t('landing.openDemo')}</RouteLink>{user && <button disabled={busy} className="button secondary" onClick={logout}>{t('account.logout')}</button>}</header>
    <main className="account-main" tabIndex={-1}>
      {loading ? <p role="status">{t('account.loading')}</p> : !user ? <Authentication onUser={loggedIn} initialError={error} retry={load} /> : <>
        <header className="account-title"><div><p className="date-line">{formatDate(new Date(), i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>{t('account.myPets')}</h1><p className="account-email">{user.email}</p></div><button className="button primary" onClick={() => { setError(null); setModal({ type: 'form' }); }}><Icon name="plus" />{t('account.addPet')}</button></header>
        <nav className="account-nav" aria-label={t('navigation')}>{['pets', 'today', 'food', 'health'].map(value => <button key={value} aria-current={section === value ? 'page' : undefined} onClick={() => setSection(value)}><Icon name={value} size={20} />{t(`nav.${value}`)}</button>)}</nav>
        <ErrorMessage error={error} />{error && <button className="button secondary" onClick={load}>{t('account.retry')}</button>}
        {!pets.length && !error ? <section className="account-empty"><div className="photo-placeholder"><Icon name="paw" size={66} /></div><h2>{t('account.emptyTitle')}</h2><p>{t('account.emptyText')}</p><button className="button primary" onClick={() => setModal({ type: 'form' })}>{t('account.addFirst')}</button><p className="small muted">{t('account.privateHint')}</p></section> : pets.length > 0 && <>
          <div className="real-pet-selector" role="group" aria-label={t('selectPet')}>{pets.map(item => <button key={item.id} aria-pressed={pet?.id === item.id} onClick={() => setSelected(item.id)}><Photo pet={item} /><span>{item.name}</span></button>)}</div>
          {section === 'pets' ? <div className="account-pet-grid">{pets.map(item => <article className={`pet-card real-pet-card ${item.id === pet?.id ? 'is-selected' : ''}`} key={item.id}><Photo pet={item} /><div className="pet-card-content"><h2>{item.name}</h2><p className="muted">{t(`account.speciesOptions.${item.species}`)}{item.breed && ` · ${item.breed}`}</p><BirthDetails pet={item} /><div className="account-card-actions"><button className="button secondary" onClick={() => setModal({ type: 'profile', pet: item })}>{t('viewProfile')}</button><button className="button primary" onClick={() => { setError(null); setModal({ type: 'form', pet: item }); }}>{t('account.edit')}</button></div></div></article>)}</div> : <section className="account-empty account-unavailable"><Icon name={section} size={44} /><h2>{t(`nav.${section}`)} · {pet.name}</h2><p>{t(`account.notConnected.${section}`)}</p><RouteLink className="button secondary" href="/demo">{t('landing.openDemo')}</RouteLink></section>}
        </>}
      </>}
    </main><footer className="account-footer"><RouteLink href="/">{t('landing.backHome')}</RouteLink><span>PetDay</span></footer>
    {modal?.type === 'form' && <PetForm pet={modal.pet} onClose={() => setModal(null)} onSaved={saved} />}
    {modal?.type === 'profile' && <Modal title={modal.pet.name} onClose={() => setModal(null)}><div className="real-profile"><Photo pet={modal.pet} /><BirthDetails pet={modal.pet} /><dl className="profile-details">{['species', 'breed', 'sex', 'features', 'allergies', 'notes'].map(key => <div key={key}><dt>{t(`account.${key}`)}</dt><dd>{key === 'species' ? t(`account.speciesOptions.${modal.pet[key]}`) : key === 'sex' ? t(`account.sexOptions.${modal.pet[key]}`) : modal.pet[key] || t('notSpecified')}</dd></div>)}</dl><div className="modal-actions"><button className="button danger" onClick={() => { setError(null); setModal({ type: 'delete', pet: modal.pet }); }}>{t('account.delete')}</button><button className="button primary" onClick={() => setModal({ type: 'form', pet: modal.pet })}>{t('account.edit')}</button></div></div></Modal>}
    {modal?.type === 'delete' && <Modal title={t('account.deleteTitle', { name: modal.pet.name })} onClose={() => { if (!busy) setModal(null); }}><p className="delete-explanation">{t('account.deleteText', { name: modal.pet.name })}</p><ErrorMessage error={error} /><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={remove}>{t(busy ? 'account.wait' : 'account.confirmDelete')}</button></div></Modal>}
  </div>;
}
