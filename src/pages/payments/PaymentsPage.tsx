import { Outlet } from "react-router-dom";

/**
 * PaymentsPage - Wrapper component for payment module nested routes
 * 
 * Routes:
 * - /payments/dashboard -> PaymentDashboard
 * - /payments/list -> PaymentList
 * - /payments/details/:paymentId -> PaymentDetails
 */
export default function PaymentsPage() {
  return <Outlet />;
}
