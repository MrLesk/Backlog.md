import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HealthCheckProvider } from './contexts/HealthCheckContext';
import { browserSnapshot } from './lib/browser-snapshot';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <HealthCheckProvider enabled={!browserSnapshot}>
      <App />
    </HealthCheckProvider>
  </React.StrictMode>
);
