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
  /** Why the follow-up is set — shown on the call list. */
  followUpRemark?: string | null;
  followUpUpdatedAt?: string | null;
  followUpUpdatedBy?: string | null;
  /** The Remarks column — a general hand-written note, kept at every status. */
  remarks?: string | null;
  remarksUpdatedAt?: string | null;
  remarksUpdatedBy?: string | null;
  /**
   * Page the website enquiry came from — the website admin's Link column.
   * Marketing reads it before calling: the page says which service the
   * client was looking at.
   */
  sourcePage?: string | null;
  /** Why the lead was lost — one of the fixed reasons. */
  lostReason?: string | null;
  lostAt?: string | null;
  /**
   * Day the enquiry was received (yyyy-MM-dd, India date) — may be earlier
   * than createdAt, e.g. a Meta Ads lead from last night entered today.
   */
  leadDate?: string | null;
  /**
   * Only on the reply to "add lead": true when this phone number already
   * had a lead in the last 24 hours, so no new lead was made — the details
   * went into that lead. ownerName = who that lead is assigned to.
   */
  alreadyExisted?: boolean;
  ownerName?: string | null;
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
  /** Page the enquiry came from. Sent by the website form. */
  sourcePage?: string;
  /** Day the enquiry was received (yyyy-MM-dd). Blank = today. */
  leadDate?: string;
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
  sourcePage?: string;
  /** Corrects the day the enquiry was received (yyyy-MM-dd). */
  leadDate?: string;
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
/**
 * Quotations linked to each lead, for the Leads table's Quotations column.
 * GET /api/leads/quotation-counts?ids=… — leads with none are omitted.
 */
export const fetchLeadQuotationCounts = async (
  leadIds: string[]
): Promise<Record<string, number>> => {
  if (leadIds.length === 0) return {};
  const res = await api.get<Record<string, number>>("/leads/quotation-counts", {
    params: { ids: leadIds.join(",") },
  });
  return res.data ?? {};
};

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
    /**
     * What was discussed. Required on every stage from Contacted to PI
     * Raised, and on Lost.
     */
    remark?: string;
    /** One of the fixed Lost reasons. Required when targetStatus is LOST. */
    lostReason?: string;
  }
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(
    `/leads/${id}/transition`,
    data
  );

  return res.data;
};

/**
 * GET /api/leads/lost-reasons
 *
 * The list behind the Lost dropdown. Served by the backend so the options
 * and the validation can't drift apart.
 */
export const fetchLostReasons = async (): Promise<string[]> => {
  const res = await api.get<string[]>("/leads/lost-reasons");
  return res.data;
};

/**
 * GET /api/leads/follow-ups
 *
 * The call list — leads whose follow-up date has arrived or already passed,
 * oldest first. Deliberately not built from the paginated `fetchLeads`
 * result: that only holds the current page, so anyone due on page 2 would
 * never be called.
 *
 * Backend scopes it by role — SALES gets their own, everyone else gets all.
 */
export const fetchFollowUpLeads = async (
  /** Admin only — narrows the list to one salesperson. Ignored for others. */
  assignedToEmail?: string
): Promise<LeadResponse[]> => {
  const res = await api.get<LeadResponse[]>("/leads/follow-ups", {
    params: assignedToEmail ? { assignedToEmail } : undefined,
  });
  return res.data;
};

/**
 * PATCH /api/leads/{id}/remark
 *
 * Sets or clears the lead's general remark — the Remarks column. Separate
 * from the follow-up remark: that one explains a scheduled call and goes
 * when the follow-up is cleared; this one stays at every status.
 * An empty string clears it.
 */
export const setLeadRemark = async (
  id: string,
  remarks: string
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(`/leads/${id}/remark`, { remarks });
  return res.data;
};

/**
 * PATCH /api/leads/{id}/follow-up
 *
 * Sets, moves or clears a lead's follow-up without touching its status.
 * Follow-up used to be a status of its own, which meant a lead could only
 * be chased between Contacted and Qualified; it is now a date the lead
 * carries at any stage up to PI Raised. Pass null to clear it.
 *
 * The backend requires a remark whenever a date is set, so whoever makes
 * the call knows what the last conversation was.
 */
export const setLeadFollowUp = async (
  id: string,
  nextFollowUpDate: string | null,
  remark?: string
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(`/leads/${id}/follow-up`, {
    nextFollowUpDate,
    remark,
  });
  return res.data;
};

/**
 * Push a lead's follow-up to a new date — the "call me on the 18th" case.
 * Uses the normal update endpoint; nothing else on the lead is touched.
 */
export const rescheduleFollowUp = async (
  id: string,
  nextFollowUpDate: string
): Promise<LeadResponse> => {
  const res = await api.patch<LeadResponse>(`/leads/update/${id}`, {
    nextFollowUpDate,
  });
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