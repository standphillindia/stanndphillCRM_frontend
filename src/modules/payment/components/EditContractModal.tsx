// src/modules/payment/components/EditContractModal.tsx
//
// Set a project's contract (total agreed) amount by hand.
//
// A project created without an amount takes its first PI's total as the
// contract, so after PI-1 is paid it shows Pending ₹0 even though PI-2 /
// Final are still to come. Finance enters the real figure here; Received
// and Pending are re-worked on the server straight away.

import { useState } from "react";
import { X } from "lucide-react";
import { setProjectContractAmount } from "../../../services/projectService";

interface Props {
  projectId: string;
  projectName: string;
  currentAmount?: number | null;
  /** Total of all PIs raised so far — shown as a hint. */
  billedSoFar?: number | null;
  onClose: () => void;
  onSaved: (amount: number) => void;
}

const inr = (n?: number | null) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

export default function EditContractModal({ projectId, projectName, currentAmount, billedSoFar, onClose, onSaved }: Props) {
  const [value, setValue] = useState(currentAmount ? String(currentAmount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(value.replace(/,/g, ""));
    if (!amount || Number.isNaN(amount) || amount <= 0) {
      setError("Enter the total contract amount (above 0).");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await setProjectContractAmount(projectId, amount);
      onSaved(Number(res.amount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the contract amount");
    } finally {
      setSaving(false);
    }
  };

  const amountNow = Number(value.replace(/,/g, "")) || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <form onSubmit={save} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">Contract amount</h2>
            <p className="text-xs text-gray-500 truncate">{projectName}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total agreed amount for the whole project (₹, incl. GST)
            </label>
            <input
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 125000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Now: {currentAmount ? inr(currentAmount) : "not set"}
              {billedSoFar != null && <> · PIs raised so far: {inr(billedSoFar)}</>}
            </p>
          </div>

          {billedSoFar != null && amountNow > 0 && amountNow < billedSoFar && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This is less than the PIs already raised ({inr(billedSoFar)}). Pending will still be worked out from
              the PIs, so nothing owed is hidden.
            </p>
          )}

          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-sm">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-white">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}