import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { amcService, type AmcDetailsResponse } from '../services/amcService';
import { formatDate, formatCurrency } from '../utils/helpers';
import AmcSummaryCard from '../components/AmcSummaryCard';
import VisitTab from '../components/VisitTab';
import ReportTab from '../components/ReportTab';
import BillingTab from '../components/BillingTab';
import PortalTab from '../components/PortalTab';
import TimelineTab from '../components/TimelineTab';
import InstallmentsTab from '../components/InstallmentsTab';
import CloseAmcModal from '../components/CloseAmcModal';

type TabType = 'overview' | 'installments' | 'visits' | 'reports' | 'billing' | 'portal' | 'timeline';

interface TabConfig {
  id: TabType;
  label: string;
  icon: string;
}

export default function AmcDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [details, setDetails] = useState<AmcDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const installmentsCount = details?.installments?.length || 0;

  const tabs: TabConfig[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'installments', label: `Installments (${installmentsCount})`, icon: '💳' },
    { id: 'visits', label: `Visits (${details?.visits.length || 0})`, icon: '👨‍🔧' },
    { id: 'reports', label: `Reports (${details?.reports.length || 0})`, icon: '📄' },
    { id: 'billing', label: `Billing (${details?.billings.length || 0})`, icon: '💰' },
    { id: 'portal', label: `Portal (${details?.portalUpdates.length || 0})`, icon: '🌐' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
  ];

  useEffect(() => {
    fetchDetails();
  }, [id, refreshKey]);

  const fetchDetails = async () => {
    if (!id) {
      setError('AMC ID not found');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await amcService.getAmcDetails(id);
      setDetails(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load AMC details');
      console.error('Error fetching AMC details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCloseAmc = async (remarks: string) => {
    if (!id) return;
    try {
      await amcService.closeAmc(id, remarks);
      alert('✅ AMC Closed Successfully!');
      setShowCloseModal(false);
      navigate('/amc/list');
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AMC Details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="p-6 max-w-6xl mx-auto bg-gray-50 min-h-screen">
        <button
          onClick={() => navigate('/amc/list')}
          className="text-blue-600 hover:text-blue-800 font-medium mb-4"
        >
          ← Back to List
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">❌ Error Loading AMC</p>
          <p className="text-sm mt-1">{error || 'Failed to load AMC details'}</p>
        </div>
      </div>
    );
  }

  const amc = details.amc;
  const canClose = amc.amcStatus === 'ACTIVE';
  const canActivate = amc.amcStatus !== 'ACTIVE';

  const handleActivate = async () => {
    if (!id) return;
    try {
      await amcService.activateAmc(id);
      alert('✅ AMC Activated!');
      handleRefresh();
    } catch (err: any) {
      alert('❌ Error: ' + err.message);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/amc/list')}
            className="text-blue-600 hover:text-blue-800 font-medium mb-2 inline-block"
          >
            ← Back to List
          </button>
          <h1 className="text-3xl font-bold text-gray-900">AMC Details</h1>
          <p className="text-gray-600 mt-1">AMC Code: <span className="font-semibold">{amc.amcCode}</span></p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
          >
            🔄 Refresh
          </button>
          {canActivate && (
            <button
              onClick={handleActivate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              ✅ Activate
            </button>
          )}
          {canClose && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              🔒 Close AMC
            </button>
          )}
        </div>
      </div>

      {/* Summary Card */}
      <AmcSummaryCard amc={amc} />

      {/* Financial Snapshot — received/pending/overdue rolled up straight
          from AmcProject, kept in sync by AmcFinanceSyncService */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Received</p>
          <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(amc.receivedAmount ?? 0)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Pending</p>
          <p className="text-xl font-bold text-orange-600 mt-1">{formatCurrency(amc.pendingAmount ?? 0)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Overdue</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(amc.overdueAmount ?? 0)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">Next Due</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {amc.nextDueDate ? formatDate(amc.nextDueDate) : '—'}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-6 py-4 font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-b-2 border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab details={details} />
          )}
          {activeTab === 'installments' && (
            <InstallmentsTab
              amcId={id!}
              installments={details.installments || []}
              contractAmount={amc.amount}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'visits' && (
            <VisitTab amcId={id!} visits={details.visits} onRefresh={handleRefresh} />
          )}
          {activeTab === 'reports' && (
            <ReportTab amcId={id!} reports={details.reports} onRefresh={handleRefresh} />
          )}
          {activeTab === 'billing' && (
            <BillingTab amcId={id!} billings={details.billings} onRefresh={handleRefresh} />
          )}
          {activeTab === 'portal' && (
            <PortalTab amcId={id!} portalUpdates={details.portalUpdates} onRefresh={handleRefresh} />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab timeline={details.timeline} />
          )}
        </div>
      </div>

      {/* Close AMC Modal */}
      {showCloseModal && (
        <CloseAmcModal
          onClose={() => setShowCloseModal(false)}
          onConfirm={handleCloseAmc}
        />
      )}
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ details }: { details: AmcDetailsResponse }) {
  const amc = details.amc;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AMC Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Client & Project</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-600">Client Name</dt>
              <dd className="text-gray-900 font-medium mt-1">{amc.clientName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Project Name</dt>
              <dd className="text-gray-900 mt-1">{amc.projectName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Factory Name</dt>
              <dd className="text-gray-900 mt-1">{amc.factoryName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">AMC Type</dt>
              <dd className="text-gray-900 mt-1">{amc.amcType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Certification Type</dt>
              <dd className="text-gray-900 mt-1">{amc.certificationType || '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Contract Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Details</h3>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-600">Start Date</dt>
              <dd className="text-gray-900 mt-1">{formatDate(amc.startDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">End Date</dt>
              <dd className="text-gray-900 mt-1">{formatDate(amc.endDate)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Duration</dt>
              <dd className="text-gray-900 mt-1">{amc.durationMonths} months</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Payment Terms</dt>
              <dd className="text-gray-900 mt-1">{amc.paymentTerms || (amc.paymentTermsDays ? `${amc.paymentTermsDays} Days` : '—')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Installments</dt>
              <dd className="text-gray-900 mt-1">{amc.installmentCount ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Renewal Date</dt>
              <dd className="text-gray-900 mt-1">{amc.renewalDate ? formatDate(amc.renewalDate) : '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-600">Amount</dt>
              <dd className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(amc.amount)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm font-medium">Total Visits</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{details.visits.length}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm font-medium">Reports</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{details.reports.length}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm font-medium">Billings</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{details.billings.length}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
          <p className="text-gray-600 text-sm font-medium">Portal Updates</p>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{details.portalUpdates.length}</p>
        </div>
      </div>

      {/* Notes */}
      {amc.notes && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
          <p className="text-gray-700 leading-relaxed">{amc.notes}</p>
        </div>
      )}
    </div>
  );
}
