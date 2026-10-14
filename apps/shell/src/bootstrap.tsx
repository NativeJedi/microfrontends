import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(<App />);

// Dead code in production builds, so the helper chunk is not emitted there.
if (process.env.NODE_ENV !== 'production') {
  import('./debug/mf-debug').then(({ installMfDebug }) => installMfDebug());
}
