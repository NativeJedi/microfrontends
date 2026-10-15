import { createRoot } from 'react-dom/client';
import ProductList from './exposed/ProductList';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(<ProductList title="Catalog" />);
