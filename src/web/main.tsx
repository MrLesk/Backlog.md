import React from 'react';
import ReactDOM from 'react-dom/client';
// Import MDEditor and Markdown preview styles for correct overlay/textarea positioning
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import App from './App';
import { HealthCheckProvider } from './contexts/HealthCheckContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <HealthCheckProvider>
      <App />
    </HealthCheckProvider>
  </React.StrictMode>
);
