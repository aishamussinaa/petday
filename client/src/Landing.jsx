import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from './components/Icon.jsx';
import Brand from './components/Brand.jsx';
import { Doodle, PawTrail, Wave } from './components/BrandArt.jsx';
import useDecorMotion from './useDecorMotion.js';
import LanguageSwitch from './components/LanguageSwitch.jsx';
import Modal from './components/Modal.jsx';
import { RouteLink, useRoute } from './routing.jsx';
import { useDemo } from './data/DemoContext.jsx';
import { Schedule, Progress } from './App.jsx';
import { formatDate, formatTime } from './dateUtils.js';

function DemoLink({ className = '', label, href = '/demo' }) {
  const { t } = useTranslation();
  return <RouteLink className={`editorial-button ${className}`} href={href}><span>{label || t('landing.openDemo')}</span><Icon name="arrow" size={21} /></RouteLink>;
}

function Preview() {
  const { t } = useTranslation();
  const { navigate } = useRoute();
  const { demo, tasks, setTasks, selected, setSelected } = useDemo();
  const pet = demo.pets.find(item => item.id === selected);
  // A real subset of the shared schedule, never a separate decorative counter.
  const visibleTasks = tasks[selected].filter(task => ['food', 'walk', 'care'].includes(task.category)).filter((task, index, list) => list.findIndex(item => item.category === task.category) === index);
  function toggle(id) {
    setTasks(previous => ({ ...previous, [selected]: previous[selected].map(task => task.id === id ? { ...task, done: !task.done, completedAt: task.done ? null : new Date().toISOString() } : task) }));
  }
  return <div className="live-preview" aria-label={t('landing.previewLabel')}>
    <div className="preview-top"><span className="paper-title">{t('nav.today')}</span><span className="demo-badge"><span />{t('demo')}</span></div>
    <div className="preview-pets" role="group" aria-label={t('selectPet')}>{demo.pets.map(item => <button key={item.id} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}><img className={`avatar-${item.species}`} src={item.image} alt="" />{item.name}</button>)}</div>
    <Progress tasks={tasks[selected]} pet={pet} />
    <Schedule tasks={visibleTasks} onToggle={toggle} onAdd={() => navigate('/demo')} addLabel={t('landing.openDemo')} />
    <p className="preview-disclaimer">{t('landing.previewHint')}</p>
  </div>;
}

function HeroCollage() {
  const { t, i18n } = useTranslation();
  return <div className="hero-collage">
    <div className="collage-blob" aria-hidden="true" />
    <Doodle kind="flower" className="hero-flower decor-spin" /><Doodle kind="trail" className="hero-trail" />
    <figure className="paper-photo hero-cat"><span className="cat-photo-crop"><img src="/images/uma.jpg" alt={t('landing.catPhoto')} width="500" height="333" /></span></figure>
    <img className="hero-poodle" src="/images/attached-poodle-cutout.png" alt={t('landing.apricotPhoto')} width="1165" height="1350" fetchPriority="high" />
    <Doodle kind="bloom" className="hero-bloom" /><Doodle kind="pawRound" filled className="hero-paw" />
    <div className="schedule-note"><span className="tape" aria-hidden="true" /><strong>{t('nav.today')}</strong><span>{formatTime('09:00', i18n.language)} · {t('tasks.breakfast')}</span><span>{formatTime('18:00', i18n.language)} · {t('categories.walk')}</span><Doodle kind="bowl" className="decor-rock" /></div>
    <p className="collage-caption">{t('landing.imageNotice')}</p>
  </div>;
}

function ProfileExamples() {
  const { t } = useTranslation();
  const { demo, setSelected } = useDemo();
  return <div className="profile-collage reveal">
    <Doodle kind="daisy" className="profile-flower decor-spin decor-spin-slow" />
    {[...demo.pets].reverse().map(pet => <RouteLink key={pet.id} className={`profile-sample paper-photo ${pet.id}`} href="/demo" onClick={() => setSelected(pet.id)}>
      <span className={pet.species === 'cat' ? 'cat-photo-crop' : undefined}><img src={pet.image} alt={t('photoAlt', { name: pet.name })} width={pet.species === 'cat' ? 500 : 700} height={pet.species === 'cat' ? 333 : 1000} loading="lazy" /></span>
      <div className="sample-caption"><h3>{pet.name}</h3><span>{t(`species.${pet.species}`)}</span><Icon name="arrow" /></div>
    </RouteLink>)}
    <div className="profile-label"><Icon name="pets" size={25} /><span>{t('landing.exampleProfiles')}</span></div>
    <div className="profile-yarn decor-hover"><Doodle kind="yarn" /></div>
    <Doodle kind="cat" className="profile-cat-doodle" />
  </div>;
}

function HealthExample() {
  const { t, i18n } = useTranslation();
  const { demo, selected } = useDemo();
  const pet = demo.pets.find(item => item.id === selected);
  return <div className="health-collage reveal">
    <figure className={`paper-photo health-photo pet-${pet.species}`}><span className={pet.species === 'cat' ? 'cat-photo-crop' : undefined}><img src={pet.image} alt={t('photoAlt', { name: pet.name })} width={pet.species === 'cat' ? 500 : 700} height={pet.species === 'cat' ? 333 : 1000} loading="lazy" /></span><figcaption>{t('landing.examplePhoto')}</figcaption></figure>
    <article className="health-paper"><span className="tape" aria-hidden="true" /><div className="health-paper-top"><Icon name="health" size={30} /><span>{t('landing.exampleRecord')}</span></div><p className="health-pet">{pet.name}</p><h3>{t('events.vet')}</h3><time>{formatDate(pet.vetDate, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}</time><p>{t('visitPlanned')}</p><span className="tag">{t('planned')}</span></article>
    <Doodle kind="star" className="health-star" /><Doodle kind="bloom" className="health-bloom decor-spin decor-spin-slow" />
    <Doodle kind="pawRound" filled className="health-paw" />
  </div>;
}

export default function Landing() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { motionEnabled, reduced, toggle } = useDecorMotion();
  useEffect(() => {
    if (!motionEnabled || !('IntersectionObserver' in window)) return;
    const animations = new Set();
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (entry.target.classList.contains('paw-trail')) entry.target.classList.add('is-visible');
      else animations.add(entry.target.animate([{ opacity: .6 }, { opacity: 1 }], { duration: 500, easing: 'ease-out' }));
      observer.unobserve(entry.target);
    }), { threshold: .1 });
    document.querySelectorAll('.profile-collage, .health-collage, .paw-trail').forEach(el => observer.observe(el));
    return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); };
  }, [motionEnabled]);
  return <div className="landing" data-decor-motion={motionEnabled ? 'on' : 'off'}>
    <a className="skip-link" href="#landing-main">{t('landing.skip')}</a>
    <header className="floating-header">
      <RouteLink className="logo-link" href="/" aria-label={t('landing.home')}><Brand /></RouteLink>
      <nav className="desktop-links" aria-label={t('navigation')}><a href="#features">{t('landing.featuresLabel')}</a><a href="#preview">{t('landing.howItWorks')}</a></nav>
      <LanguageSwitch /><DemoLink className="nav-demo" href="/app" label={t('landing.openApp')} />
      <button className="menu-toggle" aria-label={t('landing.menu')} aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)}><span className="menu-lines" /></button>
    </header>
    <main className="landing-main" id="landing-main" tabIndex={-1}>
      <section className="hero-section" aria-labelledby="landing-title">
        <div className="motion-controls"><button type="button" className="motion-toggle" role="switch" aria-checked={motionEnabled} aria-describedby={reduced ? 'motion-system-note' : undefined} disabled={reduced} onClick={toggle}><span>{t('landing.decorMotion')}</span><span className="motion-track" aria-hidden="true"><span /></span></button>{reduced && <span id="motion-system-note" className="sr-only">{t('landing.motionReduced')}</span>}</div>
        <div className="landing-hero section-wrap"><div className="hero-copy"><p className="section-kicker"><span className="kicker-line" />{t('landing.eyebrow')}</p><h1 id="landing-title">{t('landing.title')}</h1><p className="hero-description">{t('landing.description')}</p><div className="hero-actions"><DemoLink /><a className="text-link" href="#features">{t('landing.how')}<Icon name="arrow" size={20} /></a></div><p className="hero-demo-note">{t('landing.noAccount')}</p></div><HeroCollage /></div>
        <Wave className="to-yellow" layers={['pink', 'sage']} />
      </section>
      <section id="features" className="profiles-section">
        <div className="section-wrap profiles-layout"><ProfileExamples /><div className="profile-copy reveal"><p className="section-kicker">01 / {t('landing.exampleProfiles')}</p><h2>{t('landing.profileTitle')}</h2><p>{t('landing.profileText')}</p><p className="detail-note">{t('landing.profileNote')}</p><DemoLink href="/app" label={t('landing.openApp')} /><Doodle className="profile-paw" /></div></div>
        <Wave className="to-sage" variant={1} /><div className="profile-edge-art"><Doodle kind="dog" /><Doodle kind="flower" className="edge-flower" /></div>
      </section>
      <section id="preview" className="preview-section"><div className="section-wrap preview-layout"><div className="preview-copy reveal"><p className="section-kicker">02 / {t('landing.previewKicker')}</p><h2>{t('landing.previewTitle')}</h2><p>{t('landing.previewText')}</p><p className="detail-note">{t('demoNotice')}</p><PawTrail className="preview-paw-trail" /><Doodle kind="foodBowl" className="preview-bowl decor-rock" /></div><div className="reveal"><Preview /></div></div><Wave className="to-cream" variant={2} /></section>
      <section id="health" className="health-section section-wrap"><div className="health-copy reveal"><p className="section-kicker">03 / {t('nav.health')}</p><h2>{t('landing.healthTitle')}</h2><p>{t('landing.healthText')}</p><p className="detail-note">{t('landing.healthLimit')}</p><DemoLink href="/app" label={t('landing.openApp')} /></div><HealthExample /></section>
      <section className="final-invite"><Wave className="to-pink" variant={3} layers={['yellow', 'sage']} /><div className="section-wrap final-layout reveal"><Doodle kind="flower" className="final-flower decor-spin" /><Doodle kind="daisy" className="final-daisy" /><p className="section-kicker">{t('landing.finalKicker')}</p><h2>{t('landing.finalTitle')}</h2><DemoLink label={t('landing.finalAction')} /><p>{t('landing.noAccount')}</p><div className="final-yarn decor-hover"><Doodle kind="yarn" /></div><div className="final-ball decor-hover"><Doodle kind="ball" /></div><Doodle kind="cat" className="final-cat" /><PawTrail className="final-paw-trail" /></div></section>
    </main>
    <footer className="landing-footer section-wrap"><div><Brand /><p>{t('landing.footerLine')}</p></div><div className="footer-links"><a href="#features">{t('landing.featuresLabel')}</a><a href="#preview">{t('landing.howItWorks')}</a><RouteLink href="/app">{t('landing.openApp')}</RouteLink></div><p className="footer-disclaimer">{t('landing.footerDemo')}</p><span className="footer-signature">PetDay · {t('demo')}</span></footer>
    {menuOpen && <Modal title={t('landing.menu')} onClose={() => setMenuOpen(false)}><nav className="editorial-menu" aria-label={t('landing.menu')}><a href="#features" onClick={() => setMenuOpen(false)}>{t('landing.featuresLabel')}</a><a href="#preview" onClick={() => setMenuOpen(false)}>{t('landing.howItWorks')}</a><a href="#health" onClick={() => setMenuOpen(false)}>{t('nav.health')}</a><RouteLink href="/app" onClick={() => setMenuOpen(false)}>{t('landing.openApp')}<Icon name="arrow" /></RouteLink></nav><p className="menu-note">{t('landing.noAccount')}</p></Modal>}
  </div>;
}
