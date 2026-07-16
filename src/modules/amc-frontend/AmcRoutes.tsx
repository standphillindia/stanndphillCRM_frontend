import { Routes, Route, Navigate } from 'react-router-dom';
import AmcDashboard from './pages/AmcDashboard';
import AmcList from './pages/AmcList';
import CreateAmc from './pages/CreateAmc';
import AmcDetailsPage from './pages/AmcDetailsPage';

export default function AmcRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<AmcDashboard />} />
      <Route path="list" element={<AmcList />} />
      <Route path="create" element={<CreateAmc />} />
      <Route path="details/:id" element={<AmcDetailsPage />} />
    </Routes>
  );
}