import type { PaymentTransactionResponse } from "../types/payment.types";
import { formatCurrency, formatDate } from "../utils/formatting";

interface TransactionTableProps {
  transactions: PaymentTransactionResponse[];
  loading?: boolean;
}

export default function TransactionTable({
  transactions,
  loading,
}: TransactionTableProps) {
  if (loading) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>Loading transactions…</p>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p className="mb-1">No transactions recorded</p>
        <p className="text-sm text-slate-400">
          Click "Add Transaction" to record the first payment
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
              Date
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-900">
              Amount
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Mode
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Reference No
            </th>
            <th className="px-4 py-3 text-left font-semibold text-slate-900">
              Paid By
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {transactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">
                {formatDate(txn.paidDate)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                {formatCurrency(txn.amount)}
              </td>
              <td className="px-4 py-3 text-slate-600">{txn.paymentMode}</td>
              <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                {txn.referenceNo}
              </td>
              <td className="px-4 py-3 text-slate-600">{txn.paidBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}