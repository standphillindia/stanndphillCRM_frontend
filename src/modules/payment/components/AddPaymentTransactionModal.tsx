import { useState } from "react";
import { X } from "lucide-react";
import { addPaymentTransaction } from "../../../services/paymentService";
import type { AddPaymentTransactionRequest } from "../types/payment.types";

const PAYMENT_MODES = [
  "BANK_TRANSFER",
  "CHEQUE",
  "CASH",
  "UPI",
  "NEFT",
  "RTGS",
  "IMPS",
];

interface AddPaymentTransactionModalProps {
  paymentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPaymentTransactionModal({
  paymentId,
  isOpen,
  onClose,
  onSuccess,
}: AddPaymentTransactionModalProps) {
  const [amount, setAmount] = useState("");
  const [paidDate, setPaidDate] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [referenceNo, setReferenceNo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amount || !paidDate || !paidBy || !referenceNo) {
      setError("Please fill all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const payload: AddPaymentTransactionRequest = {
        amount: amountNum,
        paidDate,
        paidBy,
        paymentMode,
        referenceNo,
      };

      await addPaymentTransaction(paymentId, payload);

      setAmount("");
      setPaidDate("");
      setPaidBy("");
      setPaymentMode("BANK_TRANSFER");
      setReferenceNo("");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to add transaction";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="border-b border-slate-200 px-6 py-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Add Payment Transaction
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Record a new payment for this project
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                ₹
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paid Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              max={today}
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Payment Mode <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            >
              {PAYMENT_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Paid By <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
              disabled={loading}
              placeholder="Name or entity"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reference Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              disabled={loading}
              placeholder="Transaction ID"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-blue-400"
            >
              {loading ? "Adding…" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}