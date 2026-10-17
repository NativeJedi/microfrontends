import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// The only QueryClient on the page: remotes read and invalidate this one cache.
const queryClient = new QueryClient();

// The only router on the page: remotes rendered inside it share this history.
createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </QueryClientProvider>,
);

// Dead code in production builds, so the helper chunk is not emitted there.
if (process.env.NODE_ENV !== 'production') {
  import('./debug/mf-debug').then(({ installMfDebug }) => installMfDebug());
}
