import { NavLink, Outlet } from "react-router-dom";

/**
 * PaymentsPage - Wrapper component for payment module nested routes
 *
 * Routes:
 * - /payments/dashboard -> PaymentDashboard
 * - /payments/list -> PaymentList
 * - /payments/details/:paymentId -> PaymentDetails
 *
 * On a phone the sidebar is hidden, so the payment sections are offered as
 * a row of tabs at the top (scrolls sideways). Laptops keep the sidebar.
 */
const SECTIONS = [
  { to: "/payments/dashboard", label: "Dashboard" },
  { to: "/payments/leads", label: "Leads" },
  { to: "/payments/list", label: "Projects" },
  { to: "/payments/independent", label: "Independent" },
  { to: "/payments/amc", label: "AMC" },
  { to: "/payments/invoice-report", label: "Invoice Report" },
];

export default function PaymentsPage() {
  return (
    <>
      <nav className="lg:hidden -mx-4 px-4 mb-3 flex gap-2 overflow-x-auto pb-1" aria-label="Payment sections">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              `shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border ${
                isActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-200"
              }`
            }
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}