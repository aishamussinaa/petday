import { useEffect, useState } from 'react';

const storageKey = 'petday.decorMotion';

export default function useDecorMotion() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'off'; } catch { return true; }
  });
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function toggle() {
    if (reduced) return;
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(storageKey, next ? 'on' : 'off'); } catch { /* Settings are optional. */ }
  }
  return { motionEnabled: enabled && !reduced, reduced, toggle };
}
