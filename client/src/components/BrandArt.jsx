// Original PetDay vector artwork. Decorative by design, never interactive.
export function Doodle({ kind = 'paw', className = '', filled = false }) {
  const art = {
    pawRound: <><path d="M25 64c2-12 16-27 26-26s24 16 26 29c3 17-14 16-25 13-13-4-29 6-27-16Z"/><ellipse cx="20" cy="43" rx="8" ry="11" transform="rotate(-30 20 43)"/><ellipse cx="40" cy="23" rx="8" ry="11" transform="rotate(-10 40 23)"/><ellipse cx="63" cy="23" rx="8" ry="11" transform="rotate(10 63 23)"/><ellipse cx="82" cy="44" rx="8" ry="11" transform="rotate(30 82 44)"/></>,
    paw: <><path d="M28 61c9-9 12-24 23-22s11 15 23 25c14 14-2 28-15 21-10-6-14-2-23 1-17 5-22-12-8-25Z"/><ellipse cx="18" cy="39" rx="8" ry="12" transform="rotate(-28 18 39)"/><ellipse cx="39" cy="20" rx="8" ry="12"/><ellipse cx="63" cy="23" rx="8" ry="12" transform="rotate(18 63 23)"/><ellipse cx="83" cy="43" rx="8" ry="12" transform="rotate(29 83 43)"/></>,
    flower: <><path d="M49 34C18 4 5 39 33 48 0 62 29 88 44 64c-1 33 35 25 22-4 30 16 45-18 13-22C100 11 64 2 57 32Z" fill="currentColor" stroke="none"/><circle cx="53" cy="48" r="10" fill="var(--bg)" stroke="none"/></>,
    daisy: <><g fill="currentColor" stroke="none">{Array.from({ length: 8 }, (_, index) => <ellipse key={index} cx="50" cy="25" rx="10" ry="22" transform={`rotate(${index * 45} 50 50)`} />)}</g><circle cx="50" cy="50" r="13" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="2.5"/></>,
    bloom: <><path d="M50 31C28-7 5 21 29 41-11 44 7 78 36 64c-13 36 26 44 30 8 26 24 48-9 16-25C116 26 83 1 64 31c-3-31-35-25-14 0Z"/><circle cx="51" cy="49" r="9"/></>,
    cat: <><path d="M29 77c-7-17-3-27 0-34L25 13l22 17 9-1 20-16-2 30c7 13 8 24 0 34l3 10H27Z" fill="var(--pink)"/><path d="M76 79c32 6 15-30 10-16M37 56l-13-3m14 10-13 4m40-11 13-4m-13 11 13 4M44 83V72m17 11V72"/><ellipse cx="40" cy="44" rx="3" ry="5" fill="currentColor"/><ellipse cx="62" cy="44" rx="3" ry="5" fill="currentColor"/><path d="m48 54 4 3 4-3m-4 3v5m0 0c-5 5-8 1-8 1m8-1c5 5 8 1 8 1"/></>,
    dog: <><path d="M32 58c-7 10-9 20-8 29h51c2-13-4-24-10-30" fill="var(--yellow)"/><path d="M75 77c17-1 15-13 11-18M36 85V73m25 12V73"/><path d="M27 20C12 19 8 31 13 48c3 14 14 5 16-3m43-25c17 0 19 18 14 30-4 10-13 3-14-5" fill="var(--coral)"/><path d="M27 24c0-19 46-19 46 0l2 20c2 28-51 29-50 0Z" fill="var(--yellow)"/><circle cx="38" cy="35" r="3" fill="currentColor"/><circle cx="61" cy="35" r="3" fill="currentColor"/><path d="M45 45q5-4 10 0l-5 5Zm5 5v6m0 0c-6 5-11-1-11-1m11 1c6 5 11-1 11-1"/></>,
    foodBowl: <><path d="M20 47h60l10 35H10Z" fill="var(--sage)"/><ellipse cx="50" cy="47" rx="30" ry="9" fill="var(--bg)"/><path d="m38 40 19-18c-1-11 14-15 16-4 11-1 15 12 5 16L57 51" fill="var(--yellow)"/><path d="M25 69h13m27 0h9M12 82h76"/></>,
    ball: <><circle cx="50" cy="50" r="36"/><path d="M17 35c33 4 45 23 47 48M39 17c2 27 20 43 44 46"/></>,
    yarn: <><circle cx="47" cy="44" r="30"/><path d="M22 27c31-1 52 26 43 41M16 39c22-6 45 7 54 19M27 20c21 5 35 20 40 42M44 15c-24 17-30 37-14 53M62 20c-22 4-34 18-39 38M59 72c18 1 27 3 24 13-3 9-17 3-11-4"/></>,
    bowl: <><ellipse cx="50" cy="43" rx="38" ry="10"/><path d="M12 43c3 35 73 40 76 0M28 78h45M35 26l-4-10m20 8V12m17 15 5-10"/></>,
    star: <path d="m48 8 9 27 28-6-20 21 18 23-28-9-11 27-5-29-29 2 23-18-16-24 26 12Z"/>,
    trail: <path d="M3 78C26 95 14 20 43 25s-8 58 24 43S84 11 99 18" strokeDasharray="3 6"/>,
  };
  return <svg className={`doodle ${className}`} viewBox="0 0 100 100" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{art[kind] || art.paw}</svg>;
}

export function PawTrail({ className = '' }) {
  return <div className={`paw-trail ${className}`} aria-hidden="true">{[0, 1, 2, 3].map(index => <span key={index} style={{ '--step': index }}><Doodle kind="pawRound" filled={index % 2 === 0} /></span>)}</div>;
}

export function Wave({ className = '', variant = 0, layers = [] }) {
  const curves = [
    'M0 78C173 171 262-14 449 48s267 126 448 34S1217-6 1440 77V150H0Z',
    'M0 75C170 10 227 142 407 100S704-10 888 56s298 110 552 0V150H0Z',
    'M0 48C280 175 394 17 590 49s363 107 515 39 244-62 335-18V150H0Z',
    'M0 100C100 20 235 28 349 81S511 130 654 60s237-49 353 17 267 41 433-12V150H0Z',
  ];
  return <svg className={`section-wave wave-${variant} ${className}`} viewBox="0 0 1440 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {layers.map((color, index) => <path key={color} fill={`var(--${color})`} d={curves[(variant + index + 1) % curves.length]} transform={`translate(0 ${index * 14}) scale(1 1.25)`} />)}
    <path fill="currentColor" d={curves[variant % curves.length]} transform={`translate(0 ${layers.length * 15}) scale(1 ${layers.length ? 1 : 1.2})`} />
  </svg>;
}
