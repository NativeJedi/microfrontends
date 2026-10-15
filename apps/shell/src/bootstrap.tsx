import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

// The only router on the page: remotes rendered inside it share this history.
createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);

// Dead code in production builds, so the helper chunk is not emitted there.
if (process.env.NODE_ENV !== 'production') {
  import('./debug/mf-debug').then(({ installMfDebug }) => installMfDebug());
}
