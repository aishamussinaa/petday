import React from 'react';
import { createRoot } from 'react-dom/client';
import './i18n.js';
import './fonts.css';
import './dashboard.css';
import './pastel.css';
import './decor.css';
import './account/account.css';
import Account from './account/Account.jsx';
import App from './App.jsx';
import Landing from './Landing.jsx';
import { RouteProvider, useRoute } from './routing.jsx';
import { DemoProvider } from './data/DemoContext.jsx';

function Pages() {
  const { path } = useRoute();
  if (/^\/(app|login|register)\/?$/.test(path)) return <Account />;
  return /^\/demo\/?$/.test(path) ? <App /> : <Landing />;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><RouteProvider><DemoProvider><Pages /></DemoProvider></RouteProvider></React.StrictMode>
);
