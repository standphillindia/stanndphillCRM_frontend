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
  // ── CHANGED: now optional ────────────────────────────────────────────
  // If omitted (or left blank), the backend auto-assigns via round-robin.
  // Only send this when an admin/user explicitly picks a sales person.
  assignedToEmail?: string;
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

// Spring's @EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)
// serializes Page<T> as { content, page: { totalElements, totalPages, ... } }
// — pagination fields NESTED under "page", not top-level. The UI expects
// them flat (data.totalPages), so without this normalization both leads
// pages read `undefined` and the pagination bar never renders (the
// "undefined total AMC leads" bug). Handles both shapes so nothing breaks
// if the backend serialization mode ever changes.
interface SpringPagedModel<T> {
  content: T[];
  page?: { size: number; number: number; totalElements: number; totalPages: number };
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

function normalizePage<T>(data: SpringPagedModel<T>): {
  content: T[]; totalElements: number; totalPages: number; number: number; size: number;
} {
  return {
    content:       data.content ?? [],
    totalElements: data.totalElements ?? data.page?.totalElements ?? 0,
    totalPages:    data.totalPages    ?? data.page?.totalPages    ?? 0,
    number:        data.number        ?? data.page?.number        ?? 0,
    size:          data.size          ?? data.page?.size          ?? 10,
  };
}

// GET /api/leads/filter
export const fetchLeads = async (
  params: LeadFilterParams = {}
): Promise<PagedLeads> => {
  const res = await api.get<SpringPagedModel<LeadResponse>>(
    "/leads/filter",
    { params }
  );

  return normalizePage<LeadResponse>(res.data);
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
// ── assignedToEmail is optional now ──────────────────────────────────
// If you pass it, the backend assigns that specific person (manual override).
// If you omit it, the backend round-robins to the next SALES user automatically.
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
    // NEW — only meaningful when moving NEW -> CONTACTED on a lead with
    // no owner yet. The popup asks the employee for their own email —
    // that's who the lead gets assigned to.
    assignedToEmail?: string;
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

// GET /api/leads/finance — Pre-WON Finance page feed (ADMIN + FINANCE).
// Replaces the old getAdminLeads() usage there, which 403s for Finance
// since /leads/admin became ADMIN-only in the security hardening pass.
export const getFinanceLeads = async (): Promise<LeadResponse[]> => {
  const res = await api.get<LeadResponse[]>("/leads/finance");
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