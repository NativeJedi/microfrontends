import { Route, Routes } from 'react-router';
import ProductDetailsPage from '../pages/ProductDetailsPage';
import ProductListPage from '../pages/ProductListPage';

// Route definitions are relative to the host's mount point (/catalog/*); links use ROUTES.
// No <BrowserRouter> here: the router is owned by the host or by the standalone bootstrap.
export default function App() {
  return (
    <Routes>
      <Route index element={<ProductListPage />} />
      <Route path=":productId" element={<ProductDetailsPage />} />
    </Routes>
  );
}
