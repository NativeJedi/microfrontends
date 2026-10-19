import {
  API_CLIENT_SERVICE,
  createApiClient,
  createSession,
  SESSION_SERVICE,
} from '@mf/api-client';
import { createI18n } from '@mf/i18n';
import { createServiceContainer, ServicesProvider } from '@mf/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router';
import '@mf/tokens/tokens.css';
import './global.css';
import App from './App';
import { readStoredLanguage } from './i18n/use-language';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// The only QueryClient on the page: remotes read and invalidate this one cache.
const queryClient = new QueryClient();

// The only i18n instance on the page: remotes add their namespaces to it and never call init.
const i18n = createI18n(readStoredLanguage());

// The only session and API client on the page: one refresh in flight is shared by every app's requests.
// Remotes resolve them from this container by key; they never create their own when hosted.
const session = createSession();
const services = createServiceContainer();
services.register(SESSION_SERVICE, session);
services.register(API_CLIENT_SERVICE, createApiClient(session));

// The only router on the page: remotes rendered inside it share this history.
// The outer Suspense covers the first load of the shell's own translations.
createRoot(container).render(
  <ServicesProvider container={services}>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <Suspense fallback={null}>
            <App />
          </Suspense>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </ServicesProvider>,
);

// Dead code in production builds, so the helper chunk is not emitted there.
if (process.env.NODE_ENV !== 'production') {
  import('./debug/mf-debug').then(({ installMfDebug }) => installMfDebug());
}
