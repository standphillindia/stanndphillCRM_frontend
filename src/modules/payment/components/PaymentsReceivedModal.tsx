// "Payments received" for one PI — every payment recorded against it, with
// the received date, mode, reference no., who entered it and who last
// corrected it (Nov 2026, asked by Accounts).
//
//   • Edit   — roles with Payments → Edit (Finance by default). The PI's
//              received / balance and the project totals update on save.
//   • Delete — Admin only, always (the server refuses everyone else).
// Every edit / delete is written to the Activity Log with the old → new values.

import { useEffect, useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";
import {
  getPaymentTransactions,
  updatePaymentTransaction,
  deletePaymentTransaction,
  type PaymentTransactionResponse,
} from "../../../services/paymentService";
import { formatCurrency, formatDate } from "../utils/formatting";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAuth } from "../../../context/AuthContext";
import { getRoleFromToken } from "../../../utils/jwt";

const PAYMENT_MODES = ["BANK_TRANSFER", "CHEQUE", "CASH", "UPI", "NEFT", "RTGS", "IMPS"];

const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const errorText = (err: unknown, fallback: string) => {
  const e = err as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || fallback;
};

const when = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

interface Props {
  paymentId: string;
  invoiceNumber: string;
  totalAmount?: number;
  onClose: () => void;
  /** Called after an edit or delete so the page reloads its totals. */
  onChanged: () => void;
}

interface Draft {
  amount: string;
  paidDate: string;
  paymentMode: string;
  paidBy: string;
  referenceNo: string;
}

export default function PaymentsReceivedModal({ paymentId, invoiceNumber, totalAmount, onClose, onChanged }: Props) {
  const { token } = useAuth();
  const isAdmin = getRoleFromToken(token) === "ADMIN";
  const perms = usePermissions();
  const canEdit = isAdmin || perms.can("PAYMENTS", "EDIT");

  const [items, setItems] = useState<PaymentTransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    getPaymentTransactions(paymentId)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((err) => {
        if (alive) setError(errorText(err, "Could not load the recorded payments."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [paymentId, reloadKey]);

  const received = items.reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const startEdit = (t: PaymentTransactionResponse) => {
    setError(null);
    setNotice(null);
    setConfirmDeleteId(null);
    setEditingId(t.id);
    setDraft({
      amount: String(t.amount ?? ""),
      paidDate: t.paidDate ?? "",
      paymentMode: t.paymentMode ?? "",
      paidBy: t.paidBy ?? "",
      referenceNo: t.referenceNo ?? "",
    });
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    const amount = Number(draft.amount);
    if (!amount || amount <= 0) return setError("Enter an amount greater than zero.");
    if (!draft.paidDate) return setError("Enter the date the payment was received.");
    if (draft.paidDate > todayIst()) return setError("The received date can't be in the future.");
    if (!draft.paymentMode || !draft.paidBy.trim() || !draft.referenceNo.trim()) {
      return setError("Fill in mode, paid by and reference no.");
    }
    setBusy(true);
    setError(null);
    try {
      await updatePaymentTransaction(editingId, {
        amount,
        paidDate: draft.paidDate,
        paymentMode: draft.paymentMode,
        paidBy: draft.paidBy.trim(),
        referenceNo: draft.referenceNo.trim(),
      });
      setEditingId(null);
      setDraft(null);
      setNotice("Payment updated. Received and balance are recalculated.");
      setLoading(true);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError(errorText(err, "Could not update the payment."));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deletePaymentTransaction(id);
      setConfirmDeleteId(null);
      setNotice("Payment deleted. Received and balance are recalculated.");
      setLoading(true);
      setReloadKey((k) => k + 1);
      onChanged();
    } catch (err) {
      setError(errorText(err, "Could not delete the payment."));
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none";

  const editForm = (
    draft && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="text-xs text-gray-600">
          Amount (₹)
          <input type="number" min="0" step="0.01" value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className={field} />
        </label>
        <label className="text-xs text-gray-600">
          Received on
          <input type="date" max={todayIst()} value={draft.paidDate}
            onChange={(e) => setDraft({ ...draft, paidDate: e.target.value })} className={field} />
        </label>
        <label className="text-xs text-gray-600">
          Mode
          <select value={draft.paymentMode} onChange={(e) => setDraft({ ...draft, paymentMode: e.target.value })} className={field}>
            {!PAYMENT_MODES.includes(draft.paymentMode) && draft.paymentMode && (
              <option value={draft.paymentMode}>{draft.paymentMode}</option>
            )}
            {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Paid by
          <input value={draft.paidBy} onChange={(e) => setDraft({ ...draft, paidBy: e.target.value })} className={field} />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-2">
          Reference no. (UTR / cheque no.)
          <input value={draft.referenceNo} onChange={(e) => setDraft({ ...draft, referenceNo: e.target.value })} className={field} />
        </label>
        <div className="sm:col-span-2 flex justify-end gap-2">
          <button disabled={busy} onClick={() => { setEditingId(null); setDraft(null); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button disabled={busy} onClick={saveEdit}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    )
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Payments received</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {invoiceNumber}
              {totalAmount != null && <> · Total {formatCurrency(totalAmount)}</>}
              {!loading && <> · Received {formatCurrency(received)}</>}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {error}</div>}
          {notice && <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">✓ {notice}</div>}

          {loading ? (
            <p className="text-center text-sm text-gray-500 py-6">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-6">No payment recorded on this PI yet.</p>
          ) : (
            items.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-xl p-3.5">
                {editingId === t.id ? (
                  editForm
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{formatCurrency(t.amount)}</p>
                        <p className="text-sm text-gray-600">
                          Received on <b>{t.paidDate ? formatDate(t.paidDate) : "—"}</b>
                          {" · "}{(t.paymentMode || "—").replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {canEdit && (
                          <button onClick={() => startEdit(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                        {isAdmin && confirmDeleteId !== t.id && (
                          <button onClick={() => { setConfirmDeleteId(t.id); setEditingId(null); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-sm text-red-700 bg-red-50 hover:bg-red-100 rounded-lg">
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div><dt className="inline text-gray-500">Reference no.: </dt><dd className="inline font-medium text-gray-800 break-all">{t.referenceNo || "—"}</dd></div>
                      <div><dt className="inline text-gray-500">Paid by: </dt><dd className="inline text-gray-800">{t.paidBy || "—"}</dd></div>
                      <div><dt className="inline text-gray-500">Recorded: </dt><dd className="inline text-gray-800">
                        {t.recordedByName ? `${t.recordedByName}, ` : ""}{when(t.recordedAt) || "—"}</dd></div>
                      {t.editedAt && (
                        <div><dt className="inline text-gray-500">Last edited: </dt><dd className="inline text-amber-700">
                          {t.editedByName ? `${t.editedByName}, ` : ""}{when(t.editedAt)}</dd></div>
                      )}
                    </dl>
                    {confirmDeleteId === t.id && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex flex-wrap items-center justify-between gap-2">
                        <span>Delete this {formatCurrency(t.amount)} payment? The PI's balance will go up by this amount.</span>
                        <span className="flex gap-2">
                          <button disabled={busy} onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50">No</button>
                          <button disabled={busy} onClick={() => doDelete(t.id)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50">
                            {busy ? "Deleting…" : "Yes, delete"}
                          </button>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}