    import { useState } from 'react';
    import { amcService, type AmcPortalUpdate } from '../services/amcService';
    import { formatDate } from '../utils/helpers';

    interface Props {
    amcId: string;
    portalUpdates: AmcPortalUpdate[];
    onRefresh: () => void;
    }

    export default function PortalTab({ amcId, portalUpdates, onRefresh }: Props) {
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        portalName: '',
        remarks: '',
        document: null as File | null,
        updatedDate: '',
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
        setFormData({ ...formData, document: file });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.portalName || !formData.updatedDate || !formData.document) {
        alert('Please fill all required fields');
        return;
        }

        try {
        setLoading(true);
        await amcService.updatePortal(
            amcId,
            formData.portalName,
            formData.remarks,
            formData.updatedDate,
            formData.document
        );
        alert('✅ Portal Updated Successfully!');
        setShowForm(false);
        setFormData({ portalName: '', remarks: '', document: null, updatedDate: '' });
        onRefresh();
        } catch (err: any) {
        alert('❌ Error: ' + err.message);
        } finally {
        setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
        {/* Portal Update Form */}
        {showForm ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Portal</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Portal Name *</label>
                    <input
                    type="text"
                    value={formData.portalName}
                    onChange={(e) => setFormData({ ...formData, portalName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="e.g., Customer Portal, Dashboard"
                    required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Updated Date *</label>
                    <input
                    type="date"
                    value={formData.updatedDate}
                    onChange={(e) => setFormData({ ...formData, updatedDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                    />
                </div>
                </div>

                <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Screenshot/Document *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    id="portal-file"
                    accept="image/*,.pdf"
                    required
                    />
                    <label htmlFor="portal-file" className="cursor-pointer block">
                    {formData.document ? (
                        <div>
                        <p className="text-green-600 font-semibold">✓ {formData.document.name}</p>
                        <p className="text-xs text-gray-600 mt-1">Click to change file</p>
                        </div>
                    ) : (
                        <div>
                        <p className="text-2xl mb-2">📸</p>
                        <p className="text-gray-700 font-medium">Click to select screenshot/document</p>
                        <p className="text-xs text-gray-500 mt-1">or drag and drop (images or PDF)</p>
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
                    placeholder="Add remarks about this portal update..."
                />
                </div>

                <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={loading || !formData.document}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                    {loading ? '⏳ Uploading...' : '🌐 Update Portal'}
                </button>
                <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                >
                    Cancel
                </button>
                </div>
            </form>
            </div>
        ) : (
            <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
            + Update Portal
            </button>
        )}

        {/* Portal Updates History */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900">Portal Updates History</h3>
            <p className="text-sm text-gray-600 mt-1">Total Updates: {portalUpdates.length}</p>
            </div>

            {portalUpdates.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
                <p className="text-lg">No portal updates yet</p>
                <p className="text-sm mt-1">Update portal status to track customer communications</p>
            </div>
            ) : (
            <div className="overflow-x-auto">
                <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Portal Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Remarks</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Document</th>
                    </tr>
                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {portalUpdates.map((update) => (
                                        <tr key={update.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs">
                                                    {update.portalName}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {formatDate(update.updatedDate)}
                                            </td>

                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <span title={update.portalRemarks || ''}>
                                                    {update.portalRemarks
                                                        ? `${update.portalRemarks.substring(0, 40)}...`
                                                        : 'No Remarks'}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 text-sm">
                                                {update.documentUrl ? (
                                                    <a
                                                        href={update.documentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 font-semibold"
                                                    >
                                                        📸 View
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">
                                                        No File
                                                    </span>
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