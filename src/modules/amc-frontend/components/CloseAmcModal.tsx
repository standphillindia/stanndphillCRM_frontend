import { useState } from 'react';

interface Props {
  onClose: () => void;
  onConfirm: (remarks: string) => void;
}

export default function CloseAmcModal({ onClose, onConfirm }: Props) {
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleConfirm = async () => {
    if (!remarks.trim()) {
      alert('Please provide closing remarks');
      return;
    }

    if (!agreed) {
      alert('Please confirm that you want to close this AMC');
      return;
    }

    try {
      setLoading(true);
      await onConfirm(remarks);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
          <h3 className="text-lg font-bold text-red-900 flex items-center gap-2">
            🔒 Close AMC Contract
          </h3>
          <p className="text-sm text-red-700 mt-1">This action cannot be undone</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4 max-h-96 overflow-y-auto">
          {/* Warning Box */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800 font-medium">⚠️ Warning</p>
            <p className="text-sm text-red-700 mt-2">
              Closing this AMC will:
            </p>
            <ul className="text-sm text-red-700 list-disc list-inside mt-2 space-y-1">
              <li>Mark the contract as CLOSED</li>
              <li>Disable any further edits</li>
              <li>Preserve all data for historical records</li>
              <li>This action cannot be reversed</li>
            </ul>
          </div>

          {/* Closing Remarks */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Closing Remarks *
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={5}
              placeholder="Please provide the reason for closing this AMC..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none text-sm"
            />
            <p className="text-xs text-gray-600 mt-2">
              {remarks.length} / 500 characters
            </p>
          </div>

          {/* Confirmation Checkbox */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-gray-700">
                <span className="font-semibold">I understand</span> that closing this AMC is a permanent action and all information will be archived.
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            ✗ Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !remarks.trim() || !agreed}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '⏳ Closing...' : '🔒 Close AMC'}
          </button>
        </div>
      </div>
    </div>
  );
}