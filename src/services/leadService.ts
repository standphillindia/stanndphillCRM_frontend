// src/services/leadService.ts

import api from "../api/axios";
import type {
  LeadSource,
  LeadStatus,
} from "../constants/leadConstants";

// ─────────────────────────────────────────────────────────────
// Types matching backend DTOs
// ─────────────────────────────────────────────────────────────

export interface LeadResponse {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  product: string;
  certificationType: string;
  source: string;
  status: string;
  assignedToEmail: string;
  createdAt?: string;
  nextFollowUpDate?: string | null;
  piAccessLocked: boolean;
  piReauthorizationRequestReason: string | null;
  piReauthorizationRequestedAt: string | null;
  tiAccessLocked: boolean;
  tiReauthorizationRequestReason: string | null;
  tiReauthorizationRequestedAt: string | null;
}

export interface CreateLeadRequest {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  product: string;
  certificationType: string;
  source: LeadSource;
  assignedToEmail: string;
  nextFollowUpDate?: string | null;
}

export interface UpdateLeadRequest {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  product?: string;
  certificationType?: string;
  source?: string;
  nextFollowUpDate?: string | null;
  assignedToEmail?: string;
}

export interface LeadFilterParams {
  status?: LeadStatus;
  assignedToEmail?: string;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface PagedLeads {
  content: LeadResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface WonLeadRequest {
  targetStatus: "WON";
  amount: number;
  expectedCloseDate: string;
  notes: string;
}

// ─────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────

// GET /api/leads/filter
export const fetchLeads = async (
  params: LeadFilterParams = {}
): Promise<PagedLeads> => {
  const res = await api.get<PagedLeads>(
    "/leads/filter",
    { params }
  );

  return res.data;
};

// GET /api/leads/total
export const fetchTotalLeads = async (): Promise<number> => {
  const res = await api.get<number>(
    "/leads/total"
  );

  return res.data;
};

// GET /api/leads/get/{id}
export const fetchLeadById = async (
  id: string
): Promise<LeadResponse> => {
  const res = await api.get<LeadResponse>(
    `/leads/get/${id}`
  );

  return res.data;
};

// ── PI/TI access-lock — employee requests / Admin reauthorizes ────────
// which = "PI" or "TI"
export const requestLeadReauthorization = async (
  leadId: string,
  which: "PI" | "TI",
  reason: string
): Promise<LeadResponse> => {
  const res = await api.post<LeadResponse>(
    `/leads/${leadId}/${which}/request-reauthorization`,
    { reason }
  );
  return res.data;
};

export const reauthorizeLeadFinanceAccess = async (
  leadId: string,
  which: "PI" | "TI",
  reason?: string
): Promise<LeadResponse> => {
  const res = await api.post<LeadResponse>(
    `/leads/admin/${leadId}/${which}/reauthorize`,
    { reason }
  );
  return res.data;
};

// POST /api/leads
export const createLead = async (
  data: CreateLeadRequest
): Promise<LeadResponse> => {
  const res = await api.post<LeadResponse>(
    "/leads",
    data
  );

  return res.data;
};

// PATCH /api/leads/update/{id}
export const updateLead = async (
  id: string,
  data: UpdateLeadRequest
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(
    `/leads/update/${id}`,
    data
  );

  return res.data;
};

// DELETE /api/leads/delete/{id}
export const deleteLead = async (
  id: string
): Promise<void> => {
  await api.delete(
    `/leads/delete/${id}`
  );
};

// PATCH /api/leads/{id}/transition
export const transitionLead = async (
  id: string,
  data: {
    targetStatus: LeadStatus;
    amount?: number;
    expectedCloseDate?: string;
    notes?: string;
    // NEW — only meaningful for targetStatus="WON". Assigns an engineer +
    // department to the resulting Project right at creation.
    assignedEngineerId?: string;
    departmentId?: string;
    // NEW — the Ops person Admin picked on the Ready-to-Won review.
    opsPersonId?: string;
    // NEW — only meaningful for targetStatus="FOLLOW_UP". Date picked on
    // the follow-up popup, sent along with the transition.
    nextFollowUpDate?: string;
  }
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(
    `/leads/${id}/transition`,
    data
  );

  return res.data;
};

// GET /api/leads/admin
export const getAdminLeads = async (): Promise<
  LeadResponse[]
> => {
  const res = await api.get<
    LeadResponse[]
  >("/leads/admin");

  return res.data;
};

// GET /api/leads/my
export const getMyLeads = async (): Promise<
  LeadResponse[]
> => {
  const res = await api.get<
    LeadResponse[]
  >("/leads/my");

  return res.data;
};

// POST /api/leads/website
export const createWebsiteLead = async (
  data: Partial<CreateLeadRequest>
): Promise<LeadResponse> => {
  const res = await api.post<LeadResponse>(
    "/leads/website",
    data
  );

  return res.data;
};

// ─────────────────────────────────────────────────────────────
// Ready-to-Won admin task list (pre-WON finance flow)
// ─────────────────────────────────────────────────────────────
// One row = a lead whose PI is fully paid and whose TI is generated —
// waiting for Admin to verify PI + TI + amount, assign the Ops person +
// Engineer, and press WON (which creates the Project at Day 1).

export interface ReadyToWonLeadResponse {
  leadId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  product: string;
  certificationType: string;
  assignedToEmail: string;
  updatedAt?: string;
  piInvoiceId?: string;
  piNumber?: string;
  piTotal?: number;
  piPaid?: number;
  piPaymentStatus?: string;
  tiInvoiceId?: string;
  tiNumber?: string;
  tiIssueDate?: string;
}

export const fetchReadyToWonLeads = async (): Promise<ReadyToWonLeadResponse[]> => {
  const res = await api.get<ReadyToWonLeadResponse[]>("/leads/ready-to-won");
  return res.data;
};