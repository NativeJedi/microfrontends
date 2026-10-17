import { ROUTES } from '@mf/contracts';
import { createI18n, DEFAULT_LANGUAGE } from '@mf/i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
// Standalone only: when hosted, the shell has already loaded the tokens and owns the theme.
import '@mf/tokens/tokens.css';
import App from './exposed/App';
import { useCatalogTranslation } from './i18n/use-catalog-translation';

// Standalone mode: the remote owns the router only when it is not hosted by the shell.
function StandaloneRoutes() {
  const t = useCatalogTranslation();

  return (
    <Routes>
      <Route path={ROUTES.home} element={<Navigate to={ROUTES.catalog.root} replace />} />
      <Route path={`${ROUTES.catalog.root}/*`} element={<App />} />
      <Route path="*" element={<p>{t('standaloneForeignUrl')}</p>} />
    </Routes>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Standalone only: when hosted, the remote uses the shell's client (exposed modules never create one).
const queryClient = new QueryClient();

// Standalone only: when hosted, the remote adds its namespace to the shell's instance and never calls init.
// The language is fixed here: the shell owns language switching.
const i18n = createI18n(DEFAULT_LANGUAGE);

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <StandaloneRoutes />
        </Suspense>
      </BrowserRouter>
    </I18nextProvider>
  </QueryClientProvider>,
);
