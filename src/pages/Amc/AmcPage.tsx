import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import from modules/amc-frontend
import AmcDashboard from '../../modules/amc-frontend/pages/AmcDashboard';
import AmcList from '../../modules/amc-frontend/pages/AmcList';
import CreateAmc from '../../modules/amc-frontend/pages/CreateAmc';
import AmcDetailsPage from '../../modules/amc-frontend/pages/AmcDetailsPage';

export default function AmcPage() {
  useEffect(() => {
    // Set page title
    document.title = 'AMC Management | Standphill CRM';
  }, []);

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