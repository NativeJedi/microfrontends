import { createI18n } from '@mf/i18n';
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

// The only router on the page: remotes rendered inside it share this history.
// The outer Suspense covers the first load of the shell's own translations.
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <App />
        </Suspense>
      </BrowserRouter>
    </I18nextProvider>
  </QueryClientProvider>,
);

// Dead code in production builds, so the helper chunk is not emitted there.
if (process.env.NODE_ENV !== 'production') {
  import('./debug/mf-debug').then(({ installMfDebug }) => installMfDebug());
}
