import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 1. Safe Autoreload on ChunkLoadError / Dynamic Script import failure
window.addEventListener('error', (e) => {
  const errorMsg = e.message || '';
  if (
    errorMsg.indexOf('ChunkLoadError') > -1 || 
    errorMsg.indexOf('Loading chunk') > -1 || 
    errorMsg.indexOf('Failed to fetch dynamically imported module') > -1
  ) {
    console.warn("Chunk load failure detected. Hard reloading the page...");
    window.location.reload();
  }
}, true);

// 2. Clear stale cache upon new release deployment automatically
try {
  const CURRENT_BUILD_ID = "2026-06-02-v1";
  const lastActiveVersion = localStorage.getItem('min_ima_build_id');
  if (lastActiveVersion !== CURRENT_BUILD_ID) {
    localStorage.clear();
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
        });
      });
    }
    localStorage.setItem('min_ima_build_id', CURRENT_BUILD_ID);
    window.location.reload();
  }
} catch (error) {
  console.error("Automatic Cache Buster failed gracefully:", error);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
