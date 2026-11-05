// src/routes/AppRouter.tsx
// Full router with proper nested routes for Payment module and AMC Leads under Leads

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";
import AdminRoute from "../components/AdminRoute";
import MainLayout from "../layouts/main-layouts";

import QuotationsPage from "../pages/quotations/QuotationsPage";

import IndependentProjectsList from "../modules/payment/pages/IndependentProjectsList";
import IndependentProjectDetails from "../modules/payment/pages/IndependentProjectDetails";

// Page imports
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ReportsPage from "../pages/reports/ReportsPage";
import LeadsPage from "../pages/leads/LeadsPage";
import AMCLeadsPage from "../pages/leads/AMCLeadsPage";
import TasksPage from "../pages/tasks/TasksPage";
import ProjectsPage from "../pages/projects/ProjectsPage";
import ProjectStagesPage from "../pages/projects/ProjectStagesPage";
import CompletedProjectsPage from "../pages/projects/CompletedProjectsPage";
import MyTasksPage from "../pages/tasks/MyTasksPage";
import MyDtrPage from "../pages/dtr/MyDtrPage";
import TeamDtrPage from "../pages/dtr/TeamDtrPage";
import VisitExpensesPage from "../pages/expenses/VisitExpensesPage";
import VisitReportPage from "../pages/visit/VisitReportPage";
import PaymentsPage from "../pages/payments/PaymentsPage";
import LeadPaymentDetails from "../modules/payment/pages/LeadPaymentDetails";
import LeadPaymentsList from "../modules/payment/pages/LeadPaymentsList";
import InvoiceReport from "../modules/payment/pages/InvoiceReport";
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

          {/* All seven reports, on a page of their own. Inside the same
              protected layout as everything else, so the sidebar stays
              put and nothing opens in a new tab. */}
          <Route path="/reports" element={<ReportsPage />} />

          {/* ── Leads Module with nested AMC Leads route ────────────────── */}
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/amc-leads" element={<AMCLeadsPage />} />

          {/* Quotations. Sits at the top level rather than under /payments
              because a quotation is raised before any payment exists —
              often before the lead is even won. */}
          <Route path="/quotations" element={<QuotationsPage />} />

          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id/stages" element={<ProjectStagesPage />} />
          <Route path="/completed-projects" element={<CompletedProjectsPage />} />
          <Route path="/my-tasks" element={<MyTasksPage />} />
          {/* DTR — Daily Task Report (own) and Team DTR (Admin / HR) */}
          <Route path="/dtr" element={<MyDtrPage />} />
          <Route path="/dtr/team" element={<TeamDtrPage />} />
          <Route path="/visit-expenses" element={<VisitExpensesPage />} />
          <Route path="/visit-report/:projectId" element={<VisitReportPage />} />

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
            {/* FIX: these two were previously sitting outside this block
                (between /dashboard and /leads at the top level), which made
                them resolve to "/independent" instead of
                "/payments/independent" — no route ever matched the sidebar
                link, so the catch-all rule below sent it to /login. */}
            <Route path="independent" element={<IndependentProjectsList />} />
            <Route path="independent/:independentProjectId" element={<IndependentProjectDetails />} />
            <Route path="invoice-report" element={<InvoiceReport />} />
          </Route>

          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/certifications" element={<CertificationsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/amc/*" element={<AmcPage />} />
          <Route path="/admin" element={<AdminRoute><AdminPanelPage /></AdminRoute>} />
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