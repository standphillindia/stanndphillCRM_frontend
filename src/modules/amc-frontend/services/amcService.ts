import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth token add kar
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');  // ✅ CORRECT KEY
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface AmcProject {
  id: string;
  amcCode: string;
  clientName: string;
  projectName: string;
  factoryName: string;
  amcType: 'PROJECT_BASED' | 'MANUAL' | 'ANNUAL';
  amcStatus: 'DRAFT' | 'ACTIVE' | 'CLOSED';
  startDate: string;
  endDate: string;
  durationMonths: number;
  amount: number;
  notes: string;
  active: boolean;
  createdAt: string;

  // ── contract-centric fields ──
  certificationType?: string | null;
  paymentTerms?: string | null;
  paymentTermsDays?: number | null;
  installmentCount?: number | null;

  receivedAmount?: number | null;
  pendingAmount?: number | null;
  overdueAmount?: number | null;

  nextDueDate?: string | null;
  lastPaymentDate?: string | null;
  renewalDate?: string | null;

  assignedEngineerId?: string | null;
  salesPersonId?: string | null;
  financeOwnerId?: string | null;
}

export interface AmcVisit {
  id: string;
  amcId: string;
  engineerId: string;
  visitDate: string;
  visitTime: string;
  status: 'ASSIGNED' | 'UPCOMING' | 'SUCCESS' | 'FAILED' | 'LOST';
  documentUploaded: boolean;
  documentUrl: string;
  createdAt: string;
}

export interface AmcReport {
  id: string;
  amcId: string;
  visitId: string;
  reportType: string;
  documentUrl: string;
  remarks: string;
  receivedDate: string;
  createdAt: string;
}

export interface AmcBilling {
  id: string;
  amcId: string;
  billingDone: boolean;
  billingRemarks: string;
  billingDate: string;
  createdAt: string;
}

export interface AmcPortalUpdate {
  id: string;
  amcId: string;
  portalName: string;
  portalRemarks: string;
  documentUrl: string;
  updatedDate: string;
  createdAt: string;
}

export interface AmcTimeline {
  id: string;
  amcId: string;
  action: string;
  performedBy: string;
  createdAt: string;
}

export interface AmcComplianceWindow {
  id: string;
  amcId: string;
  visitId: string;
  windowStartDate: string;
  windowEndDate: string;
  reportDone: boolean;
  billingDone: boolean;
  portalDone: boolean;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE' | string;
}

// One row of an AMC's installment plan — mirrors backend AmcInstallmentResponse.
// `status` already reflects the linked PI's real Payment state
// (PENDING/PARTIAL/PAID/OVERDUE). The TI fields are purely informational —
// a TI is a tax-document copy of the PI, never a second receivable, so its
// amount is never summed anywhere separately from the PI's.
export interface AmcInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

  piInvoiceId: string | null;
  piInvoiceNumber: string | null;

  tiInvoiceId: string | null;
  tiInvoiceNumber: string | null;
  tiInvoiceStatus: 'DRAFT' | 'SENT' | null;
}

export interface AmcDetailsResponse {
  amc: AmcProject;
  visits: AmcVisit[];
  reports: AmcReport[];
  billings: AmcBilling[];
  portalUpdates: AmcPortalUpdate[];
  timeline: AmcTimeline[];
  complianceWindows?: AmcComplianceWindow[];
  installments?: AmcInstallment[];
}

// One row of the main AMC listing table (GET /api/amc/summary)
export interface AmcSummaryRow {
  id: string;
  amcCode: string;
  clientName: string;
  certificationType: string | null;
  contractValue: number;
  received: number;
  pending: number;
  overdue: number;
  nextDueDate: string | null;
  renewalDate: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED';
}

// Financial dashboard cards (GET /api/amc/dashboard/finance)
export interface AmcFinanceDashboard {
  totalAmcValue: number;
  collected: number;
  pending: number;
  overdue: number;
  renewalsThisMonth: number;
  expiringIn30Days: number;
  closed: number;
  active: number;
}

export interface CreateAmcPayload {
  clientName: string;
  projectName: string;
  factoryName: string;
  amcType: 'PROJECT_BASED' | 'MANUAL' | 'ANNUAL';
  startDate: string;
  endDate: string;
  durationMonths: number | '';
  amount: number | '';
  projectId?: string | null;
  notes: string;

  certificationType?: string;
  installmentCount?: number | '';
  paymentTermsDays?: number | '';
  paymentTerms?: string;
  renewalDate?: string;

  assignedEngineerId?: string | null;
  salesPersonId?: string | null;
  financeOwnerId?: string | null;
  departmentId?: string | null;
  assignedOpsUserId?: string | null;
}

export interface UpdateAmcPayload {
  clientName?: string;
  projectName?: string;
  factoryName?: string;
  amcType?: 'PROJECT_BASED' | 'MANUAL' | 'ANNUAL';
  startDate?: string;
  endDate?: string;
  durationMonths?: number;
  amount?: number;
  notes?: string;
  certificationType?: string;
  paymentTerms?: string;
  renewalDate?: string;
  assignedEngineerId?: string;
  salesPersonId?: string;
  financeOwnerId?: string;
}

// Services
export const amcService = {
  getDashboard: async () => {
    const response = await axiosInstance.get('/amc/dashboard');
    return response.data;
  },

  // Financial dashboard cards — Total AMC Value / Collected / Pending /
  // Overdue / Renewals this month / Expiring in 30 days / Closed / Active.
  getFinanceDashboard: async (): Promise<AmcFinanceDashboard> => {
    const response = await axiosInstance.get('/amc/dashboard/finance');
    return response.data;
  },

  getAllAmc: async () => {
    const response = await axiosInstance.get('/amc/getamc');
    return response.data;
  },

  // Main listing table — AMC/Client/Certification/Contract/Received/
  // Pending/Overdue/NextDue/Renewal/Status in one call.
  getSummary: async (): Promise<AmcSummaryRow[]> => {
    const response = await axiosInstance.get('/amc/summary');
    return response.data;
  },

  getAmcDetails: async (amcId: string): Promise<AmcDetailsResponse> => {
    const response = await axiosInstance.get(`/amc/${amcId}`);
    return response.data;
  },

  // Standalone installment plan (same data as details().installments)
  getInstallments: async (amcId: string): Promise<AmcInstallment[]> => {
    const response = await axiosInstance.get(`/amc/${amcId}/installments`);
    return response.data;
  },

  // For AMCs created with amount=0 (e.g. converted from a lead) — call once
  // the real contract value has been PATCHed in, to generate the schedule.
  generateInstallmentPlan: async (
    amcId: string,
    installmentCount: number,
    paymentTermsDays: number
  ) => {
    const response = await axiosInstance.post(
      `/amc/${amcId}/installments/generate`,
      null,
      { params: { installmentCount, paymentTermsDays } }
    );
    return response.data;
  },

  createAmc: async (data: CreateAmcPayload) => {
    const response = await axiosInstance.post('/amc/manual', data);
    return response.data;
  },

  updateAmc: async (id: string, data: UpdateAmcPayload) => {
    const response = await axiosInstance.patch(`/amc/${id}`, data);
    return response.data;
  },

  activateAmc: async (id: string) => {
    const response = await axiosInstance.put(`/amc/activate/${id}`);
    return response.data;
  },

  closeAmc: async (id: string, remarks?: string) => {
    const response = await axiosInstance.patch(`/amc/${id}/close`, { remarks });
    return response.data;
  },

  assignEngineer: async (data: any) => {
    const response = await axiosInstance.post('/amc/visit/assign', data);
    return response.data;
  },

  updateVisit: async (data: any) => {
    const response = await axiosInstance.put('/amc/visit/update', data);
    return response.data;
  },

  validateVisit: async (visitId: string) => {
    const response = await axiosInstance.put(`/amc/visit/validate/${visitId}`);
    return response.data;
  },

  reassignVisit: async (data: any) => {
    const response = await axiosInstance.post('/amc/visit/reassign', data);
    return response.data;
  },

  uploadVisitDocument: async (visitId: string, file: File) => {
    const formData = new FormData();
    formData.append('visitId', visitId);
    formData.append('file', file);
    const response = await axiosInstance.post('/amc/visit/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  submitLostReason: async (data: any) => {
    const response = await axiosInstance.post('/amc/visit/lost-reason', data);
    return response.data;
  },

  getReports: async (amcId: string) => {
    const response = await axiosInstance.get(`/amc/report/${amcId}`);
    return response.data;
  },

  uploadReport: async (amcId: string, visitId: string, reportType: string, remarks: string, file: File) => {
    const formData = new FormData();
    const requestData = { amcId, visitId, reportType, remarks };
    formData.append('request', JSON.stringify(requestData));
    formData.append('file', file);
    const response = await axiosInstance.post('/amc/report/receive', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateBilling: async (data: any) => {
    const response = await axiosInstance.post('/amc/billing/update', data);
    return response.data;
  },

  getBilling: async (amcId: string) => {
    const response = await axiosInstance.get(`/amc/billing/${amcId}`);
    return response.data;
  },

  updatePortal: async (amcId: string, portalName: string, remarks: string, date: string, file: File) => {
    const formData = new FormData();
    const requestData = { amcId, portalName, portalRemarks: remarks, updatedDate: date };
    formData.append('request', JSON.stringify(requestData));
    formData.append('file', file);
    const response = await axiosInstance.post('/amc/portal/update', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getPortalUpdates: async (amcId: string) => {
    const response = await axiosInstance.get(`/amc/portal/${amcId}`);
    return response.data;
  },
};

export default amcService;
