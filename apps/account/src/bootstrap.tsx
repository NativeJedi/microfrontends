import { ROUTES } from '@mf/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
// Standalone only: when hosted, the shell has already loaded the tokens and owns the theme.
import '@mf/tokens/tokens.css';
import App from './exposed/App';

// Standalone mode: the remote owns the router only when it is not hosted by the shell.
function StandaloneRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<Navigate to={ROUTES.account.root} replace />} />
      <Route path={`${ROUTES.account.root}/*`} element={<App />} />
      <Route
        path="*"
        element={<p>This URL belongs to another micro-frontend. Open it in the shell.</p>}
      />
    </Routes>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// Standalone only: when hosted, the remote uses the shell's client (exposed modules never create one).
const queryClient = new QueryClient();

createRoot(container).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <StandaloneRoutes />
    </BrowserRouter>
  </QueryClientProvider>,
);
