import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

import { AuthProvider } from './contexts/AuthContext'

// Monkey-patch window.fetch to globally attach X-Session-Config and Authorization Bearer headers
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input && (input as any).url));
  if (url && (url.startsWith('/api/') || url.includes('/api/'))) {
    init = init || {};
    
    let headers: Record<string, string> = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        headers = { ...init.headers } as Record<string, string>;
      }
    }
    
    const sessionConfig = sessionStorage.getItem("aegis_flow_config");
    if (sessionConfig) {
      headers['X-Session-Config'] = sessionConfig;
    }
    
    const token = localStorage.getItem("aegis_auth_session") || sessionStorage.getItem("aegis_auth_session");
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    init.headers = headers;
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
