// src/components/invoice/InvoiceRowCards.tsx
//
// PI / TI rows as cards on a phone — used by the Project, Lead, AMC and
// Independent payment pages under their table (which stays for laptops).
// Same buttons and the same rules as the table rows:
//   - Preview on every row;
//   - Record payment on a PI that isn't fully paid;
//   - Generate TI on a fully paid PI;
//   - Link to PI on a TI made without one.

import { FileText, Receipt, IndianRupee } from "lucide-react";
const formatCurrency = (amount?: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount ?? 0);

export interface InvoiceRowLike {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
  invoiceStatus: string;
  totalAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  sourcePiId?: string;
  sourcePiNumber?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

interface Props<R extends InvoiceRowLike> {
  rows: R[];
  generatingTi: string | null;
  onPreview: (invoiceId: string) => void;
  onRecordPayment: (row: R) => void;
  onGenerateTi: (invoiceId: string) => void;
  onLinkTi: (row: R) => void;
  /** Opens "Payments received" for a PI (date, reference no., edit). */
  onViewPayments?: (row: R) => void;
}

export default function InvoiceRowCards<R extends InvoiceRowLike>({
  rows, generatingTi, onPreview, onRecordPayment, onGenerateTi, onLinkTi, onViewPayments,
}: Props<R>) {
  return (
    <div className="divide-y divide-gray-200">
      {rows.map((row) => {
        const isPi = row.invoiceType === "PROFORMA";
        return (
          <div key={row.invoiceId} className={`p-4 ${isPi ? "" : "bg-gray-50/60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                    isPi ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {isPi ? <FileText size={12} /> : <Receipt size={12} />}
                  {isPi ? "PI" : "TI"}
                </span>
                <span className="ml-2 font-bold text-gray-900 break-all">{row.invoiceNumber}</span>
              </div>
              {row.paymentStatus && (
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[row.paymentStatus]}`}>
                  {row.paymentStatus}
                </span>
              )}
            </div>

            {!isPi && row.sourcePiNumber && (
              <p className="mt-1 text-xs text-gray-500">↳ Linked to {row.sourcePiNumber} (same payment)</p>
            )}

            <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
              <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                <span className="block text-gray-500">Total</span>
                <b className="text-gray-900">{formatCurrency(row.totalAmount)}</b>
              </div>
              <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                <span className="block text-gray-500">Received</span>
                <b className="text-green-700">{row.paidAmount != null ? formatCurrency(row.paidAmount) : "—"}</b>
                {isPi && onViewPayments && (row.paidAmount ?? 0) > 0 && (
                  <button onClick={() => onViewPayments(row)} className="block mt-0.5 text-[11px] font-semibold text-blue-700 underline">
                    View payments
                  </button>
                )}
              </div>
              <div className="rounded-lg bg-gray-50 px-2 py-1.5">
                <span className="block text-gray-500">Pending</span>
                <b className="text-orange-700">{row.dueAmount != null ? formatCurrency(row.dueAmount) : "—"}</b>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
              <button onClick={() => onPreview(row.invoiceId)} className="py-2.5 rounded-xl bg-blue-50 text-blue-700">
                View / Download
              </button>
              {isPi && row.paymentStatus !== "PAID" && (
                <button
                  onClick={() => onRecordPayment(row)}
                  className="py-2.5 rounded-xl bg-green-50 text-green-800 inline-flex items-center justify-center gap-1"
                >
                  <IndianRupee size={14} /> Record payment
                </button>
              )}
              {isPi && row.paymentStatus === "PAID" && (
                <button
                  onClick={() => onGenerateTi(row.invoiceId)}
                  disabled={generatingTi === row.invoiceId}
                  className="py-2.5 rounded-xl bg-indigo-50 text-indigo-700 disabled:opacity-50"
                >
                  {generatingTi === row.invoiceId ? "Generating…" : "Generate TI →"}
                </button>
              )}
              {!isPi && !row.sourcePiId && (
                <button onClick={() => onLinkTi(row)} className="py-2.5 rounded-xl bg-purple-50 text-purple-700">
                  Link to PI
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}