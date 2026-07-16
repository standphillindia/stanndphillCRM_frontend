import { useState } from 'react';
import { amcService, type AmcInstallment } from '../services/amcService';
import { formatDate, formatCurrency, getInstallmentStatusColor } from '../utils/helpers';

interface Props {
  amcId: string;
  installments: AmcInstallment[];
  contractAmount: number;
  onRefresh: () => void;
}

export default function InstallmentsTab({ amcId, installments, contractAmount, onRefresh }: Props) {
  const [generating, setGenerating] = useState(false);
  const [planCount, setPlanCount] = useState(4);
  const [planTermDays, setPlanTermDays] = useState(90);
  const [error, setError] = useState<string | null>(null);

  const hasPlan = installments && installments.length > 0;

  const handleGeneratePlan = async () => {
    setError(null);
    if (!contractAmount || contractAmount <= 0) {
      setError('Contract amount 0 hai — pehle AMC ka contract value edit karke set karo, tabhi plan generate hoga.');
      return;
    }
    try {
      setGenerating(true);
      await amcService.generateInstallmentPlan(amcId, planCount, planTermDays);
      onRefresh();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Plan generate nahi ho paya');
    } finally {
      setGenerating(false);
    }
  };

  if (!hasPlan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">
          Is AMC ke liye abhi koi installment plan nahi hai.
        </p>
        <div className="max-w-sm mx-auto bg-gray-50 border border-gray-200 rounded-lg p-6 text-left">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Installments</label>
              <input
                type="number"
                min={1}
                value={planCount}
                onChange={(e) => setPlanCount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Terms (days)</label>
              <input
                type="number"
                min={0}
                value={planTermDays}
                onChange={(e) => setPlanTermDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <button
            onClick={handleGeneratePlan}
            disabled={generating}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Installment Plan'}
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = installments.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = installments.reduce((sum, i) => sum + (i.paidAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{installments.length}</span> installments ·{' '}
          <span className="font-semibold text-green-700">{formatCurrency(totalPaid)}</span> received of{' '}
          <span className="font-semibold text-gray-900">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Due Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Received</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Linked PI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Linked TI</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {installments
              .slice()
              .sort((a, b) => a.installmentNumber - b.installmentNumber)
              .map((inst) => (
                <tr key={inst.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{inst.installmentNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inst.dueDate)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(inst.amount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatCurrency(inst.paidAmount)}</td>
                  <td className="px-4 py-3 text-sm">
                    {inst.piInvoiceNumber ? (
                      <span className="text-blue-600 font-medium text-xs">{inst.piInvoiceNumber}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">Not raised yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {inst.tiInvoiceNumber ? (
                      <span className="text-indigo-600 font-medium text-xs">
                        {inst.tiInvoiceNumber}
                        {inst.tiInvoiceStatus ? <span className="text-gray-400"> ({inst.tiInvoiceStatus})</span> : null}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">
                        {inst.status === 'PAID' ? 'Not generated yet' : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block ${getInstallmentStatusColor(
                        inst.status
                      )}`}
                    >
                      {inst.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        "Received" yahan sirf us installment ki PI se linked actual Payment se aata hai. TI generate hone se ye
        number badhta nahi — TI sirf ek tax-document copy hai, wahi paisa dobara nahi judta.
      </p>
    </div>
  );
}
