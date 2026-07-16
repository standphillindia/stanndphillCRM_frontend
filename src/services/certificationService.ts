// src/services/certificationService.ts
// Service for certification CRUD operations

import api from "../api/axios";

export interface CertificationResponse {
  id: string;
  projectId: string;
  projectName: string;
  companyName: string;
  certificationType: string;
  certificateNo: string;
  issueDate: string; // YYYY-MM-DD
  validityYears: number;
  remarks?: string;
  expiryDate: string; // calculated by backend
  reminderDate: string; // 30 days before expiry
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED";
  createdAt: string;
  updatedAt: string;
}

export interface CreateCertificationRequest {
  projectId: string;
  certificateNo: string;
  issueDate: string; // YYYY-MM-DD
  validityYears: number;
  remarks?: string;
}

export interface RenewCertificationRequest {
  newIssueDate: string; // YYYY-MM-DD
  newValidityYears: number;
  remarks?: string;
}

export interface FetchCertificationsParams {
  page?: number;
  size?: number;
  search?: string;
  status?: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "ALL";
  companyName?: string;
  certificationType?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

interface BackendPage {
  content: CertificationResponse[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

/**
 * Create a new certification record
 */
export const createCertification = async (
  data: CreateCertificationRequest
): Promise<CertificationResponse> => {
  const res = await api.post<CertificationResponse>("/certifications", data);
  return res.data;
};

/**
 * Fetch certifications with filtering and pagination
 */
export const fetchCertifications = async (
  params: FetchCertificationsParams
): Promise<{
  content: CertificationResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
}> => {
  const {
    page = 0,
    size = 10,
    search,
    status,
    companyName,
    certificationType,
    sortBy = "createdAt",
    sortDir = "desc",
  } = params;

  const q: Record<string, string | number> = { page, size, sortBy, sortDir };
  if (search?.trim()) q.search = search.trim();
  if (status && status !== "ALL") q.status = status;
  if (companyName?.trim()) q.companyName = companyName.trim();
  if (certificationType?.trim()) q.certificationType = certificationType.trim();

  const res = await api.get<BackendPage>("/certifications", { params: q });
  return {
    content: res.data.content,
    totalElements: res.data.page.totalElements,
    totalPages: res.data.page.totalPages,
    number: res.data.page.number,
  };
};

/**
 * Fetch a single certification by ID
 */
export const getCertification = async (id: string): Promise<CertificationResponse> => {
  const res = await api.get<CertificationResponse>(`/certifications/${id}`);
  return res.data;
};

/**
 * Fetch certifications for a specific project
 */
export const fetchCertificationByProject = async (
  projectId: string
): Promise<CertificationResponse[]> => {
  const res = await api.get<CertificationResponse[]>(
    "/certifications",
    { params: { projectId } }
  );
  return res.data;
};

/**
 * Renew an existing certification
 */
export const renewCertification = async (
  id: string,
  data: RenewCertificationRequest
): Promise<CertificationResponse> => {
  const res = await api.put<CertificationResponse>(
    `/certifications/${id}/renew`,
    data
  );
  return res.data;
};

/**
 * Delete a certification (if backend supports)
 */
export const deleteCertification = async (id: string): Promise<void> => {
  await api.delete(`/certifications/${id}`);
};

/**
 * Update certification (for manual edits)
 */
export const updateCertification = async (
  id: string,
  data: Partial<CreateCertificationRequest>
): Promise<CertificationResponse> => {
  const res = await api.put<CertificationResponse>(`/certifications/${id}`, data);
  return res.data;
};