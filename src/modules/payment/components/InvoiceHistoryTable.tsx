import type { InvoiceHistoryResponse } from "../types/payment.types";
import { formatCurrency, getStatusBadgeColor } from "../utils/formatting";

interface InvoiceHistoryTableProps {
  invoices: InvoiceHistoryResponse[];
  loading?: boolean;
}

export default function InvoiceHistoryTable({
  invoices,
  loading,
}: InvoiceHistoryTableProps) {
  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>Loading invoice history…</p>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p className="mb-1">No invoices recorded</p>
        <p className="text-sm text-slate-400">
          PI and TI records will appear here once generated
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Invoice Number
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Type
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-900">
              Amount
            </th>
            <th className="px-4 py-3 text-center font-semibold text-slate-900">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {invoices.map((invoice, idx) => (
            <tr key={idx} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                {invoice.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {invoice.invoiceType}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(invoice.amount)}
              </td>
              <td className="px-4 py-3 text-center">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                    invoice.status
                  )}`}
                >
                  {invoice.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}