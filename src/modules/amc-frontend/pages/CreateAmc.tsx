import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { amcService } from '../services/amcService';
import { markAmcLeadConverted } from '../../../services/amcLeadService';
import { fetchUsers, type UserResponse as OrgUserResponse } from '../../../services/userService';

interface FormData {
  clientName: string;
  projectName: string;
  factoryName: string;
  amcType: 'MANUAL' | 'PROJECT_BASED' | 'ANNUAL';
  startDate: string;
  endDate: string;
  durationMonths: number | '';
  amount: number | '';
  notes: string;

  certificationType: string;
  installmentCount: number | '';
  paymentTermsDays: number | '';
  renewalDate: string;

  // NEW — picked here so a project starts with both assigned right away,
  // instead of needing a separate assignment step afterward.
  assignedEngineerId: string;
  // Specific Operations-team person (replaces the old "pick a whole
  // department" dropdown — that made no sense, since a department can have
  // many people; now this works exactly like assignedEngineerId does).
  assignedOpsUserId: string;
}

const CERTIFICATION_TYPES = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'FSSC 22000', 'FSSAI',
  'TOYS', 'BIS', 'CE', 'FDA', 'GMP', 'Other',
];

// State shape passed by AMCLeadsPage.tsx when "Convert" is clicked on a
// won AMC lead — this form opens prefilled instead of silently
// auto-creating a ₹0 AMC in the background.
interface LeadPrefillState {
  fromLeadId?: string;
  prefill?: {
    clientName?: string;
    factoryName?: string;
    certificationType?: string;
    renewalDate?: string;
    notes?: string;
    projectId?: string;
  };
}

export default function CreateAmc() {
  const navigate = useNavigate();
  const location = useLocation();
  const leadState = (location.state as LeadPrefillState) || {};
  const prefill = leadState.prefill;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    clientName: prefill?.clientName || '',
    projectName: '',
    factoryName: prefill?.factoryName || '',
    amcType: 'MANUAL',
    startDate: '',
    endDate: '',
    durationMonths: '',
    amount: '',
    notes: prefill?.notes || '',
    certificationType: prefill?.certificationType || '',
    installmentCount: 1,
    paymentTermsDays: 90,
    renewalDate: prefill?.renewalDate || '',
    assignedEngineerId: '',
    assignedOpsUserId: '',
  });

  // Engineers + Ops-department users for the dropdowns below — loaded once
  // on mount. Both come from the same /org/users list, filtered client-side
  // by role (ENGINEER) and department (Operations) respectively — same
  // pattern as picking a specific engineer, just for the Ops side too.
  const [engineers, setEngineers] = useState<OrgUserResponse[]>([]);
  const [opsUsers, setOpsUsers] = useState<OrgUserResponse[]>([]);

  useEffect(() => {
    fetchUsers({ role: 'ENGINEER' }).then(setEngineers).catch(() => setEngineers([]));
    fetchUsers({}).then((all) =>
      setOpsUsers(all.filter((u) => (u.department ?? '').toLowerCase() === 'operations'))
    ).catch(() => setOpsUsers([]));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const numericFields = ['amount', 'durationMonths', 'installmentCount', 'paymentTermsDays'];
    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? (value ? Number(value) : '') : value,
    }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (updated.startDate && updated.endDate) {
        const start = new Date(updated.startDate);
        const end = new Date(updated.endDate);
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        updated.durationMonths = Math.ceil(months);
      }

      // default renewal date = contract end date, editable after
      if (name === 'endDate' && value && !prev.renewalDate) {
        updated.renewalDate = value;
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.clientName || !formData.projectName || !formData.factoryName || !formData.startDate || !formData.endDate) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        clientName: formData.clientName,
        projectName: formData.projectName,
        factoryName: formData.factoryName,
        amcType: formData.amcType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        durationMonths: formData.durationMonths,
        amount: formData.amount,
        notes: formData.notes,
        projectId: prefill?.projectId || undefined,
        certificationType: formData.certificationType || undefined,
        installmentCount: formData.installmentCount || undefined,
        paymentTermsDays: formData.paymentTermsDays || undefined,
        paymentTerms: formData.paymentTermsDays ? `${formData.paymentTermsDays} Days` : undefined,
        renewalDate: formData.renewalDate || undefined,
        assignedEngineerId: formData.assignedEngineerId || undefined,
        assignedOpsUserId: formData.assignedOpsUserId || undefined,
      };

      const response = await amcService.createAmc(payload);

      // If this form was opened from a won AMC lead, close that lead out
      // now that the real contract has been created — instead of the old
      // flow where the lead auto-created a ₹0 AMC in the background.
      if (leadState.fromLeadId) {
        try {
          await markAmcLeadConverted(leadState.fromLeadId);
        } catch (leadErr) {
          console.error('AMC created, but failed to mark lead as converted:', leadErr);
        }
      }

      alert('AMC Created Successfully!');
      navigate(`/amc/details/${response.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-6 bg-gray-50 min-h-screen max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New AMC</h1>
        <p className="text-gray-600 mt-2">Set up a new Annual Maintenance Contract</p>
      </div>

      {leadState.fromLeadId && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-blue-900 text-sm">
          <span className="font-semibold">Converting from AMC Lead.</span> Client name, certification type,
          and renewal date have been prefilled — review and complete the contract value, dates, and
          installment plan below before creating.
        </div>
      )}

      {/* Form Card */}
      <div className="bg-white rounded-lg shadow p-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client Name *</label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                placeholder="Enter client name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name *</label>
              <input
                type="text"
                name="projectName"
                value={formData.projectName}
                onChange={handleInputChange}
                placeholder="Enter project name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Factory Name *</label>
              <input
                type="text"
                name="factoryName"
                value={formData.factoryName}
                onChange={handleInputChange}
                placeholder="Enter factory name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AMC Type *</label>
              <select
                name="amcType"
                value={formData.amcType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="MANUAL">Manual</option>
                <option value="PROJECT_BASED">Project Based</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </div>
          </div>

          {/* Row 3 — Certification + Renewal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Certification Type</label>
              <select
                name="certificationType"
                value={formData.certificationType}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select certification</option>
                {CERTIFICATION_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Renewal Date</label>
              <input
                type="date"
                name="renewalDate"
                value={formData.renewalDate}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Row 3.5 - Engineer + Department assignment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign Engineer</label>
              <select
                name="assignedEngineerId"
                value={formData.assignedEngineerId}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— Assign later —</option>
                {engineers.map((eng) => (
                  <option key={eng.id} value={eng.id}>
                    {eng.fullName} ({eng.email})
                  </option>
                ))}
              </select>
              {engineers.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No engineers found — add one under Users first.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Assign Ops</label>
              <select
                name="assignedOpsUserId"
                value={formData.assignedOpsUserId}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">— Assign later —</option>
                {opsUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
              {opsUsers.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No Operations-department users found — add one under Users first.</p>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 -mt-4">
            The engineer and Ops person picked here get notified the moment this AMC is created.
          </p>

          {/* Row 4 - Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleDateChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleDateChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Row 5 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Months) *</label>
              <input
                type="number"
                name="durationMonths"
                value={formData.durationMonths}
                onChange={handleInputChange}
                placeholder="Auto-calculated"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount (₹) *</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="Enter amount"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                min="0"
                step="0.01"
                required
              />
            </div>
          </div>

          {/* Row 6 — Installment Plan */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-3">Installment Plan (optional — default: 1 installment for full amount)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Installments</label>
                <input
                  type="number"
                  name="installmentCount"
                  value={formData.installmentCount}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms (Days)</label>
                <input
                  type="number"
                  name="paymentTermsDays"
                  value={formData.paymentTermsDays}
                  onChange={handleInputChange}
                  min="0"
                  placeholder="e.g. 90"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            {formData.amount && formData.installmentCount ? (
              <p className="text-xs text-gray-500 mt-3">
                {formData.installmentCount} installments of ~₹
                {(Number(formData.amount) / Number(formData.installmentCount)).toFixed(2)} each, spread over{' '}
                {formData.paymentTermsDays || 0} days from start date.
              </p>
            ) : null}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Add any additional notes"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/amc/list')}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create AMC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}