import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { amcService } from '../services/amcService';
import type { AmcSummaryRow, AmcFinanceDashboard } from '../services/amcService';
import { formatDate, formatCurrency } from '../utils/helpers';

export default function AmcDashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<any>(null);
  const [finance, setFinance] = useState<AmcFinanceDashboard | null>(null);
  const [recentAmcs, setRecentAmcs] = useState<AmcSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashboardData, financeData, amcSummary] = await Promise.all([
        amcService.getDashboard(),
        amcService.getFinanceDashboard(),
        amcService.getSummary(),
      ]);
      setDashboard(dashboardData);
      setFinance(financeData);
      setRecentAmcs(amcSummary.slice(0, 5));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">AMC Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of your Annual Maintenance Contracts</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">{error}</div>
      )}

      {/* Financial Cards — Total AMC Value / Collected / Pending / Overdue /
          Renewals this month / Expiring in 30 days / Closed / Active */}
      {finance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Total AMC Value</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(finance.totalAmcValue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Collected</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(finance.collected)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Pending</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">{formatCurrency(finance.pending)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Overdue</p>
            <p className="text-2xl font-bold text-red-600 mt-2">{formatCurrency(finance.overdue)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Renewals This Month</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{finance.renewalsThisMonth}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Expiring in 30 Days</p>
            <p className="text-2xl font-bold text-yellow-600 mt-2">{finance.expiringIn30Days}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Closed</p>
            <p className="text-2xl font-bold text-gray-700 mt-2">{finance.closed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-500 text-xs font-medium uppercase">Active</p>
            <p className="text-2xl font-bold text-green-700 mt-2">{finance.active}</p>
          </div>
        </div>
      )}

      {/* Operational Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Total AMC</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{dashboard?.totalAmc || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Active AMC</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{dashboard?.activeAmc || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Closed AMC</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{dashboard?.expiredAmc || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Pending Visits</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{dashboard?.pendingVisit || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Pending Reports</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{dashboard?.pendingReport || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600 text-sm font-medium">Pending Billing</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{dashboard?.pendingBilling || 0}</p>
        </div>
      </div>

      {/* Recent AMCs Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent AMCs</h2>
          <button
            onClick={() => navigate('/amc/list')}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            View All →
          </button>
        </div>

        {recentAmcs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No AMCs found</p>
            <button
              onClick={() => navigate('/amc/create')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create First AMC
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">AMC Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Client</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Contract</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Received</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Next Due</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentAmcs.map((amc) => (
                  <tr key={amc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{amc.amcCode}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{amc.clientName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-right">{formatCurrency(amc.contractValue)}</td>
                    <td className="px-6 py-4 text-sm text-green-700 text-right">{formatCurrency(amc.received)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{amc.nextDueDate ? formatDate(amc.nextDueDate) : '—'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium inline-block ${amc.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {amc.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => navigate(`/amc/details/${amc.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Button */}
      <div className="mt-6">
        <button
          onClick={() => navigate('/amc/create')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Create New AMC
        </button>
      </div>
    </div>
  );
}
