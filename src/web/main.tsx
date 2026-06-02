import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HealthCheckProvider } from './contexts/HealthCheckContext';
import { I18nProvider } from './contexts/I18nContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <HealthCheckProvider>
        <App />
      </HealthCheckProvider>
    </I18nProvider>
  </React.StrictMode>
);
