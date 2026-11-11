import { createContext, useContext, useEffect, useState } from 'react';

const Routing = createContext(null);

export function RouteProvider({ children }) {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  function navigate(href) {
    window.history.pushState(null, '', href);
    setPath(window.location.pathname);
    requestAnimationFrame(() => {
      if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
      else { window.scrollTo(0, 0); document.querySelector('main')?.focus({ preventScroll: true }); }
    });
  }
  return <Routing.Provider value={{ path, navigate }}>{children}</Routing.Provider>;
}

export const useRoute = () => useContext(Routing);

export function RouteLink({ href, children, onClick, ...props }) {
  const { navigate } = useRoute();
  return <a href={href} {...props} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  }}>{children}</a>;
}
