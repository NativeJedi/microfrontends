import { Route, Routes } from 'react-router';
import CartPage from '../pages/CartPage';

// Route definitions are relative to the host's mount point (/cart/*); checkout joins here later.
export default function App() {
  return (
    <Routes>
      <Route index element={<CartPage />} />
    </Routes>
  );
}
