import { type AmcProject } from '../services/amcService';
import { formatDate, formatCurrency } from '../utils/helpers';

interface Props {
  amc: AmcProject;
}

const getStatusColor = (status: string) => {
  const statusColors: Record<string, string> = {
    'ACTIVE': 'bg-green-100 text-green-800 border-green-300',
    'CLOSED': 'bg-red-100 text-red-800 border-red-300',
    'DRAFT': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'PAYMENT_PENDING': 'bg-orange-100 text-orange-800 border-orange-300',
    'QUOTATION_SENT': 'bg-blue-100 text-blue-800 border-blue-300',
    'CANCELLED': 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
};

export default function AmcSummaryCard({ amc }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left: AMC Code and Status */}
        <div className="border-r border-gray-200 pr-6">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">AMC Code</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{amc.amcCode}</p>
          <div className="mt-4">
            <span className={`inline-block px-4 py-1 rounded-full text-sm font-semibold border ${getStatusColor(amc.amcStatus)}`}>
              ● {amc.amcStatus}
            </span>
          </div>
        </div>

        {/* Client Info */}
        <div className="border-r border-gray-200 pr-6">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Client</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{amc.clientName}</p>
          <p className="text-sm text-gray-600 mt-3">
            <span className="font-medium">Project:</span> {amc.projectName}
          </p>
          <p className="text-sm text-gray-600 mt-2">
            <span className="font-medium">Type:</span> {amc.amcType}
          </p>
        </div>

        {/* Contract Period */}
        <div className="border-r border-gray-200 pr-6">
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Contract Period</p>
          <div className="mt-3 space-y-2">
            <div>
              <p className="text-xs text-gray-600">From: <span className="font-semibold text-gray-900">{formatDate(amc.startDate)}</span></p>
              <p className="text-xs text-gray-600">To: <span className="font-semibold text-gray-900">{formatDate(amc.endDate)}</span></p>
            </div>
            <p className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1">
              <span className="font-semibold">{amc.durationMonths}</span> months
            </p>
          </div>
        </div>

        {/* Amount & Factory */}
        <div>
          <p className="text-sm font-medium text-gray-600 uppercase tracking-wide">Contract Amount</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(amc.amount)}</p>
          <p className="text-sm text-gray-600 mt-4">
            <span className="font-medium">Factory:</span>
          </p>
          <p className="text-sm text-gray-900 font-semibold mt-1">{amc.factoryName}</p>
        </div>
      </div>
    </div>
  );
}