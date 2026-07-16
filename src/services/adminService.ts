// src/services/adminService.ts
//
// Same pattern as userService.ts / documentService.ts — mock implementation
// active now, real API implementation commented right below each function.
// Flip USE_MOCK_DATA to false once the backend admin endpoints are live.

import { SELLER_INFO, BANK_DETAILS, GST_RATES } from "../constants/leadConstants";
import api from "../api/axios";

const USE_MOCK_DATA = true;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CompanySettings {
  name: string;
  gst: string;
  pan: string;
  email: string;
  phone: string;
  address: string;
  bankName: string;
  accountHolder: string;
  accountNo: string;
  ifscCode: string;
}

export interface LookupItem {
  id: string;
  value: string;
}

export interface LookupData {
  leadSources: LookupItem[];
  certificationTypes: LookupItem[];
  gstRates: { id: string; value: number }[];
}

export interface SystemConfig {
  invoicePrefix: string;
  invoiceStartNumber: number;
  defaultCurrency: string;
  dateFormat: string;
  notifyOnNewLead: boolean;
  notifyOnPaymentReceived: boolean;
  notifyOnCertificateExpiry: boolean;
}

export interface ActivityLogEntry {
  id: string;
  user: string;
  action: string;
  module: string;
  timestamp: string;
}

// Filter params the Admin Panel's Activity Log tab sends to the backend.
// All optional — omit a field to not filter on it.
export interface ActivityLogFilters {
  module?: string;      // "LEAD" | "DEAL" | "USER" | "AMC" | "CERTIFICATION" | "PROJECT"
  performedBy?: string; // user UUID
  from?: string;        // yyyy-MM-dd
  to?: string;          // yyyy-MM-dd
  search?: string;
  page?: number;        // 0-indexed
  size?: number;
}

// Matches Spring's Page<T> JSON shape (content + pagination metadata).
export interface ActivityLogPage {
  content: ActivityLogEntry[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-indexed)
  size: number;
}

// Static list for the module filter dropdown — mirrors ActivityService's
// MODULE_LABELS map on the backend. Update both sides if you add a module.
export const ACTIVITY_MODULES: { value: string; label: string }[] = [
  { value: "LEAD", label: "Leads" },
  { value: "DEAL", label: "Deals" },
  { value: "PROJECT", label: "Projects" },
  { value: "USER", label: "Users" },
  { value: "AMC", label: "AMC" },
  { value: "CERTIFICATION", label: "Certifications" },
];

// ─────────────────────────────────────────────────────────────
// MOCK DATA STORE (in-memory, resets on page refresh)
// ─────────────────────────────────────────────────────────────

let mockCompanySettings: CompanySettings = {
  name: SELLER_INFO.NAME,
  gst: SELLER_INFO.GST,
  pan: SELLER_INFO.PAN,
  email: SELLER_INFO.EMAIL,
  phone: SELLER_INFO.PHONE,
  address: SELLER_INFO.ADDRESS,
  bankName: BANK_DETAILS.BANK_NAME,
  accountHolder: BANK_DETAILS.ACCOUNT_HOLDER,
  accountNo: BANK_DETAILS.ACCOUNT_NO,
  ifscCode: BANK_DETAILS.IFSC_CODE,
};

let mockLookupData: LookupData = {
  leadSources: [
    { id: "ls-1", value: "Manual" },
    { id: "ls-2", value: "Website" },
    { id: "ls-3", value: "Phone" },
    { id: "ls-4", value: "Email" },
    { id: "ls-5", value: "Referral" },
    { id: "ls-6", value: "Social Media" },
    { id: "ls-7", value: "Advertisement" },
  ],
  certificationTypes: [
    { id: "ct-1", value: "ISO" },
    { id: "ct-2", value: "BIS" },
    { id: "ct-3", value: "CE" },
    { id: "ct-4", value: "FMCS" },
    { id: "ct-5", value: "CRS" },
  ],
  gstRates: GST_RATES.map((r, i) => ({ id: `gst-${i}`, value: r.value })),
};

let mockSystemConfig: SystemConfig = {
  invoicePrefix: "SPI",
  invoiceStartNumber: 1001,
  defaultCurrency: "INR",
  dateFormat: "DD/MM/YYYY",
  notifyOnNewLead: true,
  notifyOnPaymentReceived: true,
  notifyOnCertificateExpiry: true,
};

const delay = (ms = 350) => new Promise((res) => setTimeout(res, ms));
const genId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// ─────────────────────────────────────────────────────────────
// GET/PUT /api/admin/company  →  company settings
// ─────────────────────────────────────────────────────────────
export const fetchCompanySettings = async (): Promise<CompanySettings> => {
  if (USE_MOCK_DATA) {
    await delay();
    return mockCompanySettings;
  }
  // const res = await api.get<CompanySettings>("/admin/company");
  // return res.data;
  throw new Error("Real /api/admin/company endpoint not implemented yet");
};

export const updateCompanySettings = async (
  data: CompanySettings
): Promise<CompanySettings> => {
  if (USE_MOCK_DATA) {
    await delay();
    mockCompanySettings = { ...data };
    return mockCompanySettings;
  }
  // const res = await api.put<CompanySettings>("/admin/company", data);
  // return res.data;
  throw new Error("Real PUT /api/admin/company endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/lookup  →  lead sources / certification types / gst rates
// ─────────────────────────────────────────────────────────────
export const fetchLookupData = async (): Promise<LookupData> => {
  if (USE_MOCK_DATA) {
    await delay();
    return mockLookupData;
  }
  // const res = await api.get<LookupData>("/admin/lookup");
  // return res.data;
  throw new Error("Real /api/admin/lookup endpoint not implemented yet");
};

export const addLookupItem = async (
  category: "leadSources" | "certificationTypes",
  value: string
): Promise<LookupItem> => {
  if (USE_MOCK_DATA) {
    await delay(250);
    const item: LookupItem = { id: genId("lk"), value };
    mockLookupData = { ...mockLookupData, [category]: [...mockLookupData[category], item] };
    return item;
  }
  // const res = await api.post<LookupItem>(`/admin/lookup/${category}`, { value });
  // return res.data;
  throw new Error("Real POST /api/admin/lookup/{category} endpoint not implemented yet");
};

export const removeLookupItem = async (
  category: "leadSources" | "certificationTypes",
  id: string
): Promise<void> => {
  if (USE_MOCK_DATA) {
    await delay(250);
    mockLookupData = {
      ...mockLookupData,
      [category]: mockLookupData[category].filter((i) => i.id !== id),
    };
    return;
  }
  // await api.delete(`/admin/lookup/${category}/${id}`);
  throw new Error("Real DELETE /api/admin/lookup/{category}/{id} endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// GET/PUT /api/admin/system-config
// ─────────────────────────────────────────────────────────────
export const fetchSystemConfig = async (): Promise<SystemConfig> => {
  if (USE_MOCK_DATA) {
    await delay();
    return mockSystemConfig;
  }
  // const res = await api.get<SystemConfig>("/admin/system-config");
  // return res.data;
  throw new Error("Real /api/admin/system-config endpoint not implemented yet");
};

export const updateSystemConfig = async (
  data: SystemConfig
): Promise<SystemConfig> => {
  if (USE_MOCK_DATA) {
    await delay();
    mockSystemConfig = { ...data };
    return mockSystemConfig;
  }
  // const res = await api.put<SystemConfig>("/admin/system-config", data);
  // return res.data;
  throw new Error("Real PUT /api/admin/system-config endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/activity-log
// ─────────────────────────────────────────────────────────────
export const fetchActivityLog = async (
  filters: ActivityLogFilters = {}
): Promise<ActivityLogPage> => {
  // Real backend endpoint — admin-only (GET /api/admin/activity-log).
  // Non-admins get a 403; this tab should only be reachable by admins anyway.
  const res = await api.get<ActivityLogPage>("/admin/activity-log", {
    params: {
      module: filters.module || undefined,
      performedBy: filters.performedBy || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      search: filters.search || undefined,
      page: filters.page ?? 0,
      size: filters.size ?? 25,
    },
  });
  return res.data;
};