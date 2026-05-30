import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

import { AuthProvider } from './contexts/AuthContext'

// Monkey-patch window.fetch to globally attach X-Session-Config header containing sessionStorage configuration
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && (input as any).url));
  if (url && (url.startsWith('/api/') || url.includes('/api/'))) {
    init = init || {};
    const sessionConfig = sessionStorage.getItem("aegis_flow_config");
    if (sessionConfig) {
      if (!init.headers) {
        init.headers = {};
      }
      if (init.headers instanceof Headers) {
        init.headers.set('X-Session-Config', sessionConfig);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['X-Session-Config', sessionConfig]);
      } else {
        init.headers = {
          ...init.headers,
          'X-Session-Config': sessionConfig
        };
      }
    }
  }
  return originalFetch(input, init);
};

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
