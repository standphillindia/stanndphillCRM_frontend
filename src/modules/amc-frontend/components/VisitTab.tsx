import { useState, useEffect } from 'react';
import { amcService, type AmcVisit } from '../services/amcService';
import { formatDate } from '../utils/helpers';
import { fetchUsers, type UserResponse as OrgUserResponse } from '../../../services/userService';

interface Props {
  amcId: string;
  visits: AmcVisit[];
  onRefresh: () => void;
}

export default function VisitTab({ amcId, visits, onRefresh }: Props) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignFormData, setAssignFormData] = useState({
    engineerId: '',
    visitDate: '',
    remarks: '',
  });

  // NEW — this used to require typing the raw Engineer UUID by hand. Now
  // it lists every real ENGINEER from the DB by name, click to select.
  const [engineers, setEngineers] = useState<OrgUserResponse[]>([]);

  useEffect(() => {
    fetchUsers({ role: 'ENGINEER' }).then(setEngineers).catch(() => setEngineers([]));
  }, []);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFormData.engineerId || !assignFormData.visitDate) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      await amcService.assignEngineer({
        amcId,
        engineerId: assignFormData.engineerId,
        visitDate: assignFormData.visitDate,
        remarks: assignFormData.remarks,
      });
      alert('✅ Engineer Assigned Successfully!');
      setShowAssignForm(false);
      setAssignFormData({ engineerId: '', visitDate: '', remarks: '' });
      onRefresh();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async (visitId: string) => {
    if (!window.confirm('Validate this visit?')) return;

    try {
      await amcService.validateVisit(visitId);
      alert('✅ Visit Validated!');
      onRefresh();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleReassign = async (visitId: string) => {
    const engineerId = prompt('Enter new Engineer ID:');
    if (!engineerId) return;

    try {
      await amcService.reassignVisit({
        visitId,
        engineerId,
      });
      alert('✅ Visit Reassigned!');
      onRefresh();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleUploadDocument = async (visitId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        await amcService.uploadVisitDocument(visitId, file);
        alert('✅ Document Uploaded!');
        onRefresh();
      } catch (err: any) {
        alert('❌ Error: ' + err.message);
      }
    };
    input.click();
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      'ASSIGNED': 'bg-blue-100 text-blue-800',
      'UPCOMING': 'bg-yellow-100 text-yellow-800',
      'SUCCESS': 'bg-green-100 text-green-800',
      'FAILED': 'bg-red-100 text-red-800',
      'LOST': 'bg-gray-100 text-gray-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Assign Engineer Form */}
      {showAssignForm ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign Engineer</h3>
          <form onSubmit={handleAssignSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Engineer *</label>
                <select
                  value={assignFormData.engineerId}
                  onChange={(e) => setAssignFormData({ ...assignFormData, engineerId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Select an engineer…</option>
                  {engineers.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.fullName} ({eng.email})
                    </option>
                  ))}
                </select>
                {engineers.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">No engineers found — add one under Users first.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visit Date *</label>
                <input
                  type="date"
                  value={assignFormData.visitDate}
                  onChange={(e) => setAssignFormData({ ...assignFormData, visitDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
              <textarea
                value={assignFormData.remarks}
                onChange={(e) => setAssignFormData({ ...assignFormData, remarks: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Add any remarks..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? '⏳ Assigning...' : '+ Assign Engineer'}
              </button>
              <button
                type="button"
                onClick={() => setShowAssignForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowAssignForm(true)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Assign Engineer
        </button>
      )}

      {/* Visits Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Visit History</h3>
          <p className="text-sm text-gray-600 mt-1">Total Visits: {visits.length}</p>
        </div>

        {visits.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg">No visits scheduled yet</p>
            <p className="text-sm mt-1">Assign an engineer to start scheduling visits</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Engineer ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Visit Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{visit.engineerId}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(visit.visitDate)}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(visit.status)}`}>
                        {visit.status}
                      </span>
                    </td>
                        <td className="px-6 py-4 text-sm">
                            {visit.documentUploaded ? (
                                <a
                                    href={visit.documentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    📄 View Doc
                                </a>
                            ) : (
                                <button
                                    onClick={() => handleUploadDocument(visit.id)}
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                    📤 Upload
                                </button>
                            )}
                        </td>
                    <td className="px-6 py-4 text-sm space-x-2">
                      {visit.status === 'ASSIGNED' || visit.status === 'UPCOMING' ? (
                        <>
                          <button
                            onClick={() => handleValidate(visit.id)}
                            className="text-green-600 hover:text-green-800 font-semibold"
                          >
                            ✓ Validate
                          </button>
                          <button
                            onClick={() => handleReassign(visit.id)}
                            className="text-orange-600 hover:text-orange-800 font-semibold"
                          >
                            🔄 Reassign
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-500 text-xs">No actions</span>
                      )}
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