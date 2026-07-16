import { useState } from 'react';
import { amcService, type AmcReport } from '../services/amcService';
import { formatDate } from '../utils/helpers';

interface Props {
  amcId: string;
  reports: AmcReport[];
  onRefresh: () => void;
}

export default function ReportTab({ amcId, reports, onRefresh }: Props) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reportFile: null as File | null,
    remarks: '',
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, reportFile: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reportFile) {
      alert('Please select a file');
      return;
    }

    try {
      setLoading(true);
      const reportType = formData.reportFile.name.split('.').pop()?.toUpperCase() || 'DOCUMENT';
      
      await amcService.uploadReport(
        amcId,
        '',
        reportType,
        formData.remarks,
        formData.reportFile
      );
      alert('✅ Report Uploaded Successfully!');
      setShowUploadForm(false);
      setFormData({ reportFile: null, remarks: '' });
      onRefresh();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      {showUploadForm ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Report</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report File *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  id="report-file"
                  required
                />
                <label htmlFor="report-file" className="cursor-pointer block">
                  {formData.reportFile ? (
                    <div>
                      <p className="text-green-600 font-semibold">✓ {formData.reportFile.name}</p>
                      <p className="text-xs text-gray-600 mt-1">Click to change file</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-2xl mb-2">📤</p>
                      <p className="text-gray-700 font-medium">Click to select report file</p>
                      <p className="text-xs text-gray-500 mt-1">or drag and drop (PDF, DOC, XLS, etc)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Add remarks about this report..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !formData.reportFile}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                {loading ? '⏳ Uploading...' : '📤 Upload Report'}
              </button>
              <button
                type="button"
                onClick={() => setShowUploadForm(false)}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setShowUploadForm(true)}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Upload Report
        </button>
      )}

      {/* Reports Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Report History</h3>
          <p className="text-sm text-gray-600 mt-1">Total Reports: {reports.length}</p>
        </div>

        {reports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="text-lg">No reports uploaded yet</p>
            <p className="text-sm mt-1">Upload a report to track maintenance work</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Report Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Remarks</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(report.receivedDate)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                        {report.reportType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span title={report.remarks}>{report.remarks.substring(0, 50)}...</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      
                        href={report.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-semibold"
                      <a>
                        📄 Download
                      </a>
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