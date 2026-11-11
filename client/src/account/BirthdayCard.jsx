import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useDecorMotion from '../useDecorMotion.js';
import { formatDate } from '../dateUtils.js';
import { birthdayWindow } from './birthday.js';
import './birthday.css';

function Cake() {
  return <svg className="birthday-cake" viewBox="0 0 240 220" aria-hidden="true">
    <circle cx="120" cy="115" r="94" fill="#ffe36d" />
    <g className="cake-body" stroke="#362438" strokeWidth="2.5" strokeLinejoin="round">
      <ellipse cx="120" cy="191" rx="83" ry="10" fill="#cee5b2" />
      <path d="M55 128h130v49c0 18-130 18-130 0Z" fill="#f29bc1" />
      <path d="M55 152c30 12 100 12 130 0" fill="none" />
      <ellipse cx="120" cy="128" rx="65" ry="18" fill="#fff8ec" />
      <path d="M55 128v16c0 12 15 12 15 0v-1c0-5 13-3 13 3v11c0 12 16 12 16 0v-6c0-7 16-7 16 0v3c0 11 15 11 15 0v-3c0-7 16-7 16-1v4c0 11 16 11 16 0v-12c0-5 10-5 10-1c0 10 13 9 13-2v-11" fill="#fff8ec" />
      <rect x="113" y="83" width="14" height="45" rx="3" fill="#cee5b2" />
      <path d="m114 93 12-5m-12 20 12-5m-12 20 12-5" />
      <path className="cake-flame" d="M120 53c-2 11-14 13-10 24 4 10 20 8 21-3 1-8-8-12-11-21Z" fill="#f9ad58" />
      <path d="M79 123l6 3m58-3 5-4m-44 15 7-1m48 4 4-3" stroke="#f29bc1" strokeWidth="4" />
    </g>
    <g fill="#362438"><circle cx="106" cy="172" r="3" /><circle cx="134" cy="172" r="3" /><path d="M114 176q6 7 12 0" fill="none" stroke="#362438" strokeWidth="2.5" strokeLinecap="round" /></g>
    <g fill="#f29bc1" stroke="#362438" strokeWidth="2"><path d="m51 61 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" /><path d="m187 87 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /></g>
  </svg>;
}

function Celebration({ pet, info }) {
  const { t, i18n } = useTranslation();
  const { motionEnabled, reduced, toggle } = useDecorMotion();
  const birthday = info.days === 0;
  const storageKey = `petday.birthday.${pet.id}.${info.key}`;
  const [burst, setBurst] = useState(() => {
    if (!birthday || !motionEnabled) return 0;
    try { return localStorage.getItem(storageKey) !== 'seen' ? 1 : 0; } catch { return 1; }
  });
  const [animating, setAnimating] = useState(burst > 0);
  useEffect(() => {
    if (!burst || !motionEnabled) { setAnimating(false); return; }
    setAnimating(true);
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* Optional celebration preference. */ }
    const timer = setTimeout(() => setAnimating(false), 4500);
    return () => clearTimeout(timer);
  }, [burst, motionEnabled, storageKey]);
  return <section className={`birthday-card ${birthday ? 'birthday-party' : 'birthday-countdown'} ${animating && motionEnabled ? 'is-celebrating' : ''}`} aria-label={t('party.label')}>
    <div className="birthday-art" aria-hidden="true">
      {birthday ? <Cake /> : <div className="birthday-number"><strong>{info.days}</strong><span>{t('party.until')}</span><span className="birthday-number-star">✦</span></div>}
    </div>
    <div className="birthday-copy"><span className="eyebrow">{t(birthday ? 'party.today' : 'party.soon')}</span>
      <h2>{t(birthday ? 'party.title' : 'party.countdown', { name: pet.name, count: info.days })}</h2>
      <p>{t(birthday ? 'party.wish' : 'party.prepare')}</p>
      {!birthday && <><div className="birthday-week" aria-hidden="true">{[7, 6, 5, 4, 3, 2, 1].map(day => <span key={day} className={day === info.days ? 'current' : day > info.days ? 'passed' : ''}>{day}</span>)}<span>🎂</span></div><p className="small">{formatDate(info.birthday, i18n.language, { day: 'numeric', month: 'long' })}</p></>}
      {pet.birthApproximate && <p className="small birthday-estimate">{t('party.approximate')}</p>}
      {birthday && <div className="birthday-actions"><button type="button" className="button primary" disabled={!motionEnabled} onClick={() => setBurst(value => value + 1)}>{t('party.replay')}</button>{!reduced && <button type="button" className="button secondary" aria-pressed={motionEnabled} onClick={toggle}>{t(motionEnabled ? 'party.motionOff' : 'party.motionOn')}</button>}{reduced && <span className="small">{t('party.reduced')}</span>}</div>}
    </div>
    {birthday && animating && motionEnabled && <div key={burst} className="birthday-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ '--x': `${(index * 43) % 100}%`, '--delay': `${(index % 6) * .12}s`, '--turn': `${index % 2 ? 270 : -270}deg`, '--color': ['#f29bc1', '#cee5b2', '#ffe36d', '#a99ad4'][index % 4] }} />)}</div>}
  </section>;
}

export default function BirthdayCard({ pet, now = new Date() }) {
  const info = birthdayWindow(pet.birthDate, now);
  return info ? <Celebration key={`${pet.id}-${info.key}-${info.days}`} pet={pet} info={info} /> : null;
}
