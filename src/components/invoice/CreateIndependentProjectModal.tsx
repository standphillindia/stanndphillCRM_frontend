// src/components/invoice/CreateIndependentProjectModal.tsx

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  createIndependentProject,
  updateIndependentProject,
  type IndependentProjectResponse,
} from "../../services/invoiceService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: IndependentProjectResponse) => void;

  /**
   * Present when editing. Doubles as the edit/create switch, so there is
   * one form to maintain rather than two that drift apart.
   *
   * Editing matters most for carriedForwardReceivedAmount: it's the money
   * collected before the CRM existed, typed in from memory, and getting it
   * wrong leaves the record claiming more received than the contract is
   * worth with nothing to correct it.
   */
  existing?: {
    id: string;
    projectName?: string;
    certificationType?: string;
    clientName?: string;
    clientEmail?: string;
    clientGst?: string;
    billingAddress?: string;
    clientContactPerson?: string;
    clientPhone?: string;
    contractAmount?: number;
    carriedForwardReceivedAmount?: number;
    notes?: string;
  } | null;
}

export default function CreateIndependentProjectModal({
  isOpen,
  onClose,
  onCreated,
  existing,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    projectName: "",
    certificationType: "",
    clientName: "",
    clientEmail: "",
    clientGst: "",
    billingAddress: "",
    clientContactPerson: "",
    clientPhone: "",
    contractAmount: "",
    carriedForwardReceivedAmount: "",
    notes: "",
  });

  // The list only carries a summary row, so an edit loads the full record
  // before opening. Reset on close too, or the next "New" opens holding the
  // last edited record's values.
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setFormData({
      projectName: existing?.projectName ?? "",
      certificationType: existing?.certificationType ?? "",
      clientName: existing?.clientName ?? "",
      clientEmail: existing?.clientEmail ?? "",
      clientGst: existing?.clientGst ?? "",
      billingAddress: existing?.billingAddress ?? "",
      clientContactPerson: existing?.clientContactPerson ?? "",
      clientPhone: existing?.clientPhone ?? "",
      contractAmount: existing?.contractAmount != null ? String(existing.contractAmount) : "",
      carriedForwardReceivedAmount:
        existing?.carriedForwardReceivedAmount != null
          ? String(existing.carriedForwardReceivedAmount)
          : "",
      notes: existing?.notes ?? "",
    });
  }, [isOpen, existing]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Every field is optional — the team often has only part of the
    // client's details and needs the PI out first so the first payment can
    // come in. A blank name is filled from the company name on the server;
    // a blank contract amount stays "not set" until it's known.
    if (formData.contractAmount && Number(formData.contractAmount) < 0) {
      setError("Contract amount can't be negative");
      return;
    }
    if (formData.carriedForwardReceivedAmount && Number(formData.carriedForwardReceivedAmount) < 0) {
      setError("Already received can't be negative");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = {
        projectName: formData.projectName.trim() || undefined,
        certificationType: formData.certificationType || undefined,
        clientName: formData.clientName || undefined,
        clientEmail: formData.clientEmail || undefined,
        clientGst: formData.clientGst || undefined,
        billingAddress: formData.billingAddress || undefined,
        clientContactPerson: formData.clientContactPerson || undefined,
        clientPhone: formData.clientPhone || undefined,
        contractAmount: formData.contractAmount ? Number(formData.contractAmount) : 0,
        carriedForwardReceivedAmount: formData.carriedForwardReceivedAmount
          ? Number(formData.carriedForwardReceivedAmount)
          : 0,
        notes: formData.notes || undefined,
      };

      const saved = existing
        ? await updateIndependentProject(existing.id, payload)
        : await createIndependentProject(payload);

      onCreated(saved);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${existing ? "update" : "create"} independent record`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {existing ? "Edit Independent Record" : "New Independent Record"}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-black hover:bg-opacity-20 p-1 rounded transition">
            <X size={24} />
          </button>
        </div>

        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 text-sm text-blue-900">
          ℹ️ {existing
            ? "Editing the record only. Invoices already raised against it are untouched."
            : "All fields are optional — fill what you have now and complete the rest later with Edit. You'll issue the PI/TI in the next step, from the record's own page."}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <input type="text" name="projectName" value={formData.projectName} onChange={handleChange}
                placeholder="e.g. ISI - Agarwalla Energy Solutions"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Certification / Label</label>
              <input type="text" name="certificationType" value={formData.certificationType} onChange={handleChange}
                placeholder="e.g. ISI, BIS, CE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="text" inputMode="email" name="clientEmail" value={formData.clientEmail} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" name="clientGst" value={formData.clientGst} onChange={handleChange}
                  placeholder="e.g. 07AHNPJ2190E1ZE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="text" name="clientPhone" value={formData.clientPhone} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                <input type="text" name="billingAddress" value={formData.billingAddress} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" name="clientContactPerson" value={formData.clientContactPerson} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">Contract Value</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Contract Amount (₹)</label>
                <input type="number" name="contractAmount" value={formData.contractAmount} onChange={handleChange}
                  min="0" step="0.01" placeholder="Not known yet"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Already Received (₹)</label>
                <input type="number" name="carriedForwardReceivedAmount" value={formData.carriedForwardReceivedAmount}
                  onChange={handleChange} min="0" step="0.01" placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-500 mt-1">If some payment already came in before this record existed in the CRM.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:bg-gray-400">
              {loading
                ? existing ? "Saving..." : "Creating..."
                : existing ? "Save Changes" : "Create Record"}
            </button>
            <button type="button" onClick={onClose}
              className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}