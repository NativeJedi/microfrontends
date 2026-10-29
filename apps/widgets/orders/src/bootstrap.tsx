import {
  API_CLIENT_SERVICE,
  createApiClient,
  createSession,
  DEV_CREDENTIALS,
  SESSION_SERVICE,
} from '@mf/api-client';
import { ROUTES } from '@mf/contracts';
import { createI18n, DEFAULT_LANGUAGE } from '@mf/i18n';
import { createServiceContainer, ServicesProvider } from '@mf/services';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
// Standalone only: when hosted, the shell has already loaded the tokens and owns the theme.
import '@mf/tokens/tokens.css';
import App from './exposed/App';
import Widget, { meta } from './exposed/Widget';
import { useOrdersWidgetTranslation } from './i18n/use-orders-widget-translation';

// Standalone mode: the card at "/", the application at the same URL the dashboard mounts it under, so a
// deep link is the same string in both places. The card's "Open" link is the dashboard's chrome, so this
// page renders its own.
function StandaloneCard() {
  const t = useOrdersWidgetTranslation();

  return (
    <>
      <h1>{meta.title}</h1>
      <Widget settings={{ limit: 5 }} size={meta.defaultSize} />
      <p>
        <Link to={ROUTES.dashboard.widget('orders')}>{t('standaloneOpenApp')}</Link>
      </p>
    </>
  );
}

function StandaloneRoutes() {
  const t = useOrdersWidgetTranslation();

  return (
    <Routes>
      <Route path={ROUTES.home} element={<StandaloneCard />} />
      <Route path={`${ROUTES.dashboard.widget('orders')}/*`} element={<App />} />
      <Route path="*" element={<p>{t('standaloneForeignUrl')}</p>} />
    </Routes>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Standalone only: when hosted, the widget uses the shell's client (exposed modules never create one).
const queryClient = new QueryClient();

// Standalone only: when hosted, the widget adds its namespace to the shell's instance and never calls init.
// The language is fixed here: the shell owns language switching.
const i18n = createI18n(DEFAULT_LANGUAGE);

// Standalone only: when hosted, the widget resolves the shell's session and API client (one per page).
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

// A router, since this widget became an application: `./App` renders <Routes> and needs a history above
// it. The dashboard filter still comes from the shell's container on :3000 — this page is a host of the
// shell exactly as it is under the dashboard, which is why :3000 has to be running for it to render.
createRoot(container).render(
  <ServicesProvider container={services}>
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <BrowserRouter>
          <Suspense fallback={null}>
            <main>
              <StandaloneRoutes />
            </main>
          </Suspense>
        </BrowserRouter>
      </I18nextProvider>
    </QueryClientProvider>
  </ServicesProvider>,
);
