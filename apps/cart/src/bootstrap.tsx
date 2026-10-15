import { ROUTES } from '@mf/contracts';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import App from './exposed/App';

// Standalone mode: the remote owns the router only when it is not hosted by the shell.
function StandaloneRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.home} element={<Navigate to={ROUTES.cart} replace />} />
      <Route path={`${ROUTES.cart}/*`} element={<App />} />
      <Route
        path="*"
        element={<p>This URL belongs to another micro-frontend. Open it in the shell.</p>}
      />
    </Routes>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <BrowserRouter>
    <StandaloneRoutes />
  </BrowserRouter>,
);
