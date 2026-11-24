import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Account from '../account/Account.jsx';
import { ApiContext } from '../account/ApiContext.jsx';
import { createDemoStore } from './demoStore.js';
import './sandbox.css';

let sessionStore;
export default function DemoWorkspace() {
  const { i18n } = useTranslation();
  const [store] = useState(() => sessionStore ||= createDemoStore({ t: (...args) => i18n.t(...args) }));
  const [generation, setGeneration] = useState(0);
  function reset() {
    store.reset(); setGeneration(value => value + 1);
    requestAnimationFrame(() => document.getElementById('account-main')?.focus());
  }
  return <ApiContext.Provider value={store.request}><Account key={generation} demo onReset={reset} /></ApiContext.Provider>;
}
