// src/services/amcLeadService.ts

import api from "../api/axios";
import type {
  AMCLeadSource,
  AMCLeadStatus,
} from "../constants/amcLeadConstants";

// ─────────────────────────────────────────────────────────────
// Types matching backend DTOs
// ─────────────────────────────────────────────────────────────

export interface AMCLeadResponse {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  certificationType: string;
  certificateNumber: string;
  issueDate?: string;
  expiryDate?: string;
  renewalReminderDate?: string;
  nextFollowUpDate?: string;
  status: string;
  assignedToEmail: string;
  source: string;
  projectId?: string | null;
  converted?: boolean;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAMCLeadRequest {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  certificationType: string;
  certificateNumber: string;
  issueDate?: string;
  expiryDate?: string;
  renewalReminderDate?: string;
  nextFollowUpDate?: string;
  source: AMCLeadSource;
  assignedToEmail: string;
}

export interface UpdateAMCLeadRequest {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  certificationType?: string;
  certificateNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  renewalReminderDate?: string;
  nextFollowUpDate?: string;
  source?: string;
  assignedToEmail?: string;
}

export interface AMCLeadFilterParams {
  status?: AMCLeadStatus;
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

export interface PagedAMCLeads {
  content: AMCLeadResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface TransitionAMCLeadRequest {
  targetStatus: AMCLeadStatus;
  // NEW — only meaningful for targetStatus="FOLLOW_UP". Date picked on
  // the follow-up popup in the AMC Leads table.
  nextFollowUpDate?: string;
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

// GET /api/amc-leads/filter
export const fetchAMCLeads = async (
  params: AMCLeadFilterParams = {}
): Promise<PagedAMCLeads> => {
  const res = await api.get<SpringPagedModel<AMCLeadResponse>>(
    "/amc-leads/filter",
    { params }
  );

  return normalizePage<AMCLeadResponse>(res.data);
};

// GET /api/amc-leads/{id}
export const fetchAMCLeadById = async (
  id: string
): Promise<AMCLeadResponse> => {
  const res = await api.get<AMCLeadResponse>(
    `/amc-leads/${id}`
  );

  return res.data;
};

// POST /api/amc-leads
export const createAMCLead = async (
  data: CreateAMCLeadRequest
): Promise<AMCLeadResponse> => {
  const res = await api.post<AMCLeadResponse>(
    "/amc-leads",
    data
  );

  return res.data;
};

// PATCH /api/amc-leads/{id}
export const updateAMCLead = async (
  id: string,
  data: UpdateAMCLeadRequest
): Promise<AMCLeadResponse> => {
  const res = await api.patch<AMCLeadResponse>(
    `/amc-leads/${id}`,
    data
  );

  return res.data;
};

// DELETE /api/amc-leads/{id}
export const deleteAMCLead = async (
  id: string
): Promise<void> => {
  await api.delete(
    `/amc-leads/${id}`
  );
};

// PATCH /api/amc-leads/{id}/transition
export const transitionAMCLead = async (
  id: string,
  data: TransitionAMCLeadRequest
): Promise<AMCLeadResponse> => {
  const res = await api.patch<AMCLeadResponse>(
    `/amc-leads/${id}/transition`,
    data
  );

  return res.data;
};

// POST /api/amc-leads/{id}/convert
export const convertAMCLead = async (
  id: string
): Promise<AMCLeadResponse> => {
  const res = await api.post<AMCLeadResponse>(
    `/amc-leads/${id}/convert`
  );

  return res.data;
};

// GET /api/amc-leads/total
export const fetchTotalAMCLeads = async (): Promise<number> => {
  const res = await api.get<number>(
    "/amc-leads/total"
  );

  return res.data;
};

// GET /api/amc-leads/my
export const getMyAMCLeads = async (): Promise<
  AMCLeadResponse[]
> => {
  const res = await api.get<
    AMCLeadResponse[]
  >("/amc-leads/my");

  return res.data;
};

// POST /api/amc-leads/{id}/mark-converted
// Used after the team submits the Create AMC form (prefilled from this
// lead) and the AMC is created successfully — closes out the lead without
// going through the old auto-convert (amount=0) path.
export const markAmcLeadConverted = async (
  id: string
): Promise<AMCLeadResponse> => {
  const res = await api.post<AMCLeadResponse>(
    `/amc-leads/${id}/mark-converted`
  );

  return res.data;
};