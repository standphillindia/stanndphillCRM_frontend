// src/routes/AppRouter.tsx
// Full router with proper nested routes for Payment module and AMC Leads under Leads

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";
import MainLayout from "../layouts/main-layouts";

// Page imports
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import LeadsPage from "../pages/leads/LeadsPage";
import AMCLeadsPage from "../pages/leads/AMCLeadsPage";
import TasksPage from "../pages/tasks/TasksPage";
import ProjectsPage from "../pages/projects/ProjectsPage";
import ProjectStagesPage from "../pages/projects/ProjectStagesPage";
import MyTasksPage from "../pages/tasks/MyTasksPage";
import PaymentsPage from "../pages/payments/PaymentsPage";
import LeadPaymentDetails from "../modules/payment/pages/LeadPaymentDetails";
import LeadPaymentsList from "../modules/payment/pages/LeadPaymentsList";
import DocumentsPage from "../pages/documents/DocumentsPage";
import CertificationsPage from "../pages/certifications/CertificationsPage";
import UsersPage from "../pages/users/UsersPage";
import AmcPage from "../pages/Amc/AmcPage";
import AdminPanelPage from "../pages/admin/AdminPanelPage";
import NotificationsPage from "../pages/Notification/NotificationsPage"; // ✅ NEW

// Payment module component imports
import PaymentDashboard from "../modules/payment/pages/PaymentDashboard";
import ProjectPaymentsList from "../modules/payment/pages/ProjectPaymentsList";
import ProjectPaymentDetails from "../modules/payment/pages/ProjectPaymentDetails";
import AmcPaymentsList from "../modules/payment/pages/AmcPaymentsList";
import AmcPaymentDetails from "../modules/payment/pages/AmcPaymentDetails";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public Routes ──────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Protected Routes wrapped in ProtectedRoute + MainLayout ──── */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* ── Leads Module with nested AMC Leads route ────────────────── */}
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/amc-leads" element={<AMCLeadsPage />} />

          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id/stages" element={<ProjectStagesPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />

          {/* ── Payment Module with Nested Routes ────────────────── */}
          <Route path="/payments" element={<PaymentsPage />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<PaymentDashboard />} />
            <Route path="list" element={<ProjectPaymentsList />} />
            <Route path="project/:projectId" element={<ProjectPaymentDetails />} />
            <Route path="amc" element={<AmcPaymentsList />} />
            <Route path="amc/:amcId" element={<AmcPaymentDetails />} />
            <Route path="leads" element={<LeadPaymentsList />} />
            <Route path="lead/:leadId" element={<LeadPaymentDetails />} />
          </Route>

          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/certifications" element={<CertificationsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/amc/*" element={<AmcPage />} />
          <Route path="/admin" element={<AdminPanelPage />} />
        </Route>

        {/* ── Fallbacks ──────────────────────────────────────── */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
        {/* ✅ Notifications Page */}
        <Route path="/notifications" element={<NotificationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}