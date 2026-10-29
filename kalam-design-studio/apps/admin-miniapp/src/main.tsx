import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// The Studio is also used outside Telegram. Registering the worker only in a
// production build keeps Vite's development server predictable while letting
// browsers install the HTTPS Studio as a standalone app.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/studio/sw.js', {
      scope: '/studio/',
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
