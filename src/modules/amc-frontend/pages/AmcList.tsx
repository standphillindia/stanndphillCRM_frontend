import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { amcService } from '../services/amcService';
import type { AmcSummaryRow } from '../services/amcService';
import { formatDate, formatCurrency } from '../utils/helpers';

export default function AmcList() {
  const navigate = useNavigate();
  const [amcs, setAmcs] = useState<AmcSummaryRow[]>([]);
  const [filteredAmcs, setFilteredAmcs] = useState<AmcSummaryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAmcs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [amcs, searchTerm, statusFilter]);

  const fetchAmcs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await amcService.getSummary();
      setAmcs(data);
    } catch (err: any) {
      console.error('Error:', err.message);
      setError(err.message || 'Failed to load AMC list');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...amcs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (amc) =>
          amc.amcCode.toLowerCase().includes(term) ||
          amc.clientName.toLowerCase().includes(term) ||
          (amc.certificationType || '').toLowerCase().includes(term)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter((amc) => amc.status === statusFilter);
    }

    setFilteredAmcs(filtered);
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AMC Management</h1>
          <p className="text-gray-600 mt-2">View and manage all contracts — with live financial status</p>
        </div>
        <button
          onClick={() => navigate('/amc/create')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create AMC
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by code, client or certification..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CLOSED">Closed</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Table — the finance dashboard's "jaan": Contract / Received /
          Pending / Overdue / Next Due / Renewal / Status in one glance */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredAmcs.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <p>No AMCs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">AMC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Certification</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Contract</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Received</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Pending</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Overdue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Next Due</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Renewal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAmcs.map((amc) => (
                  <tr key={amc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{amc.amcCode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{amc.clientName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{amc.certificationType || '—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right whitespace-nowrap">
                      {formatCurrency(amc.contractValue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-green-700 font-medium text-right whitespace-nowrap">
                      {formatCurrency(amc.received)}
                    </td>
                    <td className="px-4 py-3 text-sm text-orange-600 text-right whitespace-nowrap">
                      {formatCurrency(amc.pending)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right whitespace-nowrap ${amc.overdue > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {formatCurrency(amc.overdue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {amc.nextDueDate ? formatDate(amc.nextDueDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {amc.renewalDate ? formatDate(amc.renewalDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${amc.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : amc.status === 'CLOSED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>
                        {amc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
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
    </div>
  );
}
