import {
  API_CLIENT_SERVICE,
  createApiClient,
  createSession,
  DEV_CREDENTIALS,
  SESSION_SERVICE,
} from '@mf/api-client';
import { createI18n, DEFAULT_LANGUAGE } from '@mf/i18n';
import { createServiceContainer, ServicesProvider } from '@mf/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
// Standalone only: when hosted, the shell has already loaded the tokens and owns the theme.
import '@mf/tokens/tokens.css';
import App from './exposed/App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Standalone only: when hosted, the remote uses the shell's client (exposed modules never create one).
const queryClient = new QueryClient();

// Standalone only: when hosted, the remote adds its namespace to the shell's instance and never calls init.
// The language is fixed here: the shell owns language switching.
const i18n = createI18n(DEFAULT_LANGUAGE);

// Standalone only: when hosted, the remote resolves the shell's session and API client (one per page).
const session = createSession();
const api = createApiClient(session);
const services = createServiceContainer();
services.register(SESSION_SERVICE, session);
services.register(API_CLIENT_SERVICE, api);

// Standalone dev login: the login page belongs to the shell. The auth cookies are shared by all localhost
// ports, so the API accepts them from this origin too; the session flag is per origin, hence the login here.
if (process.env.NODE_ENV !== 'production' && !session.isLoggedIn()) {
  await api
    .login(DEV_CREDENTIALS)
    .catch((error: unknown) => console.warn('Standalone dev login failed', error));
}

// No router: the dashboard is one page, so it needs no <BrowserRouter> here either. Standalone it is
// still a host — the widgets are loaded exactly as they are under the shell, one level shallower.
createRoot(container).render(
  <ServicesProvider container={services}>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Suspense fallback={null}>
          <main>
            <App />
          </main>
        </Suspense>
      </I18nextProvider>
    </QueryClientProvider>
  </ServicesProvider>,
);
