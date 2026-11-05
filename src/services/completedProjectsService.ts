// src/services/completedProjectsService.ts
//
// GET /api/completed-projects — every finished project (last stage done or
// certificate created), with month-wise counts. Open to every signed-in
// user: Digital Marketing uses it to put new licences on the website.

import api from "../api/axios";

export interface CompletedProjectRow {
  projectId: string;
  projectName: string;
  companyName: string | null;
  certificationType: string | null;
  product: string | null;
  certificateNo: string | null;
  licenseIssueDate: string | null;   // yyyy-MM-dd
  licenseExpiryDate: string | null;
  completedOn: string | null;        // yyyy-MM-dd
  status: "LICENSE_GRANTED" | "CLOSED";
  contactName: string | null;
  city: string | null;
  state: string | null;
  engineerName: string | null;
  opsPersonName: string | null;
}

export interface MonthCount {
  month: string;   // "2026-10"
  count: number;
}

export interface CompletedProjectsResponse {
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
  total: number;
  lastTwelveMonths: MonthCount[];
  rows: CompletedProjectRow[];
}

export interface CompletedProjectsFilter {
  from?: string;   // yyyy-MM-dd
  to?: string;     // yyyy-MM-dd
  search?: string;
}

export const fetchCompletedProjects = async (
  filter: CompletedProjectsFilter = {}
): Promise<CompletedProjectsResponse> => {
  const params: Record<string, string> = {};
  if (filter.from) params.from = filter.from;
  if (filter.to) params.to = filter.to;
  if (filter.search?.trim()) params.search = filter.search.trim();
  const res = await api.get<CompletedProjectsResponse>("/completed-projects", { params });
  return res.data;
};