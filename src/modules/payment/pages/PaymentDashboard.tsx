import { useEffect, useState } from "react";
import { getPaymentDashboard } from "../../../services/paymentService";
import type { PaymentDashboardResponse } from "../types/payment.types";
import { formatCurrency, formatNumber } from "../utils/formatting";

export default function PaymentDashboard() {
  const [dashboard, setDashboard] = useState<PaymentDashboardResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPaymentDashboard();
        setDashboard(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load dashboard";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Payment Dashboard
          </h1>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (loading || !dashboard) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Payment Dashboard
          </h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded border border-slate-200 p-6 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-slate-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const collectionRate =
    dashboard.totalCollection === 0 ||
    dashboard.totalCollection + dashboard.totalPending === 0
      ? 0
      : (
          (dashboard.totalCollection /
            (dashboard.totalCollection + dashboard.totalPending)) *
          100
        ).toFixed(1);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Payment Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor project payments and financial overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded border border-slate-200 p-6">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">
              Total Collection
            </p>
            <h3 className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboard.totalCollection)}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-6">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">
              Total Pending
            </p>
            <h3 className="text-2xl font-bold text-orange-600">
              {formatCurrency(dashboard.totalPending)}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-6">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">
              Total Projects
            </p>
            <h3 className="text-2xl font-bold text-blue-600">
              {formatNumber(dashboard.totalProjects)}
            </h3>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-6">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">
              Overdue Payments
            </p>
            <h3 className="text-2xl font-bold text-red-600">
              {formatNumber(dashboard.overduePayments)}
            </h3>
            {dashboard.overduePayments > 0 && (
              <p className="text-xs text-red-500 mt-1">Attention required</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Collection Rate
          </h3>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-600">Collection %</span>
              <span className="text-lg font-bold text-blue-600">
                {collectionRate}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{
                  width: `${collectionRate}%`,
                }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Quick Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Avg per Project</span>
              <span className="font-bold text-slate-900">
                {dashboard.totalProjects > 0
                  ? formatCurrency(
                      (dashboard.totalCollection + dashboard.totalPending) /
                        dashboard.totalProjects
                    )
                  : "₹0.00"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Portfolio Value</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(
                  dashboard.totalCollection + dashboard.totalPending
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}