import api from "../api/axios";

export type ProjectStage =
  | "DRAFT"
  | "PROJECT_CREATED"
  | "DOCUMENT_COLLECTION"
  | "PORTAL_REGISTRATION"
  | "PROFILE_CREATION"
  | "SAMPLE_PLANNING"
  | "SAMPLE_SENT_TO_CLIENT"
  | "CLIENT_SAMPLE_READY"
  | "SAMPLE_SENT_TO_LAB"
  | "ENGINEER_VISIT"
  | "DOCUMENT_UPLOAD"
  | "LAB_REPORT_RECEIVED"
  | "APPLICATION_REVIEW"
  | "FEE_PAYMENT"
  | "APPLICATION_SUBMITTED"
  | "INSPECTION"
  | "QUERY_HANDLING"
  | "LICENSE_GRANTED"
  | "CLOSED";

// A project now carries its own money fields directly (no more Deal in
// between) — mirrors AmcProject on the backend. `dealId` is gone,
// replaced by `leadId` (which Lead this project came from, if any).
export interface ProjectResponse {
  id: string;
  projectName: string;
  certificationType: string;
  startDate: string | null;
  deadline: string | null;
  stage: ProjectStage;
  leadId: string | null;
  teamName: string | null;
  engineerEmail: string | null;
  departmentName: string | null;
  amount: number;
  receivedAmount: number;
  pendingAmount: number;
  overdueAmount: number;
}

// NOTE: CreateProjectRequest / createProject() were removed — POST
// /projects no longer exists on the backend. Projects are now created
// automatically the moment a Lead goes WON (starting in DRAFT stage).

export interface ProjectTransitionRequest {
  targetStage: ProjectStage;
  visitDate?: string;
  engineerEmail?: string;
}

export interface AssignProjectRequest {
  engineerEmail: string;
  teamName: string;
}

export interface VisitResponse {
  id: string;
  projectName: string;
  engineerEmail: string;
  visitDate: string;
  status: "SCHEDULED" | "COMPLETED" | "EXPIRED" | "RESCHEDULED" | "CANCELLED";
  reason: string | null;
}

export interface ScheduleVisitRequest {
  engineerEmail: string;
  visitDate: string;
}

export interface CompleteVisitRequest {
  visitImageUrl: string;
  remarks: string;
}

export interface RescheduleVisitRequest {
  newVisitDate: string;
  reason: string;
}

interface BackendPage {
  content: ProjectResponse[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

export interface FetchProjectsParams {
  page?: number;
  size?: number;
  search?: string;
  stage?: ProjectStage | "ALL";
  engineerEmail?: string;
  teamName?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export const fetchProjects = async (
  params: FetchProjectsParams
): Promise<{
  content: ProjectResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
}> => {
  const {
    page = 0, size = 10, search, stage, engineerEmail,
    teamName, deadlineFrom, deadlineTo, sortBy = "createdAt", sortDir = "desc",
  } = params;

  const q: Record<string, string | number> = { page, size, sortBy, sortDir };
  if (search?.trim())           q.search        = search.trim();
  if (stage && stage !== "ALL") q.stage         = stage;
  if (engineerEmail?.trim())    q.engineerEmail = engineerEmail.trim();
  if (teamName?.trim())         q.teamName      = teamName.trim();
  if (deadlineFrom)             q.deadlineFrom  = deadlineFrom;
  if (deadlineTo)               q.deadlineTo    = deadlineTo;

  const res = await api.get<BackendPage>("/projects/filter", { params: q });
  return {
    content:       res.data.content,
    totalElements: res.data.page.totalElements,
    totalPages:    res.data.page.totalPages,
    number:        res.data.page.number,
  };
};

// NEW — same data as fetchProjects() above, but reachable under
// /api/payments/projects instead of /api/projects/filter. Used by the
// Payments > List page so a Finance-role user only needs PAYMENTS module
// access to see it (not PROJECTS, which would also expose the full
// Projects module in their sidebar).
export const fetchProjectsForPayments = async (
  params: FetchProjectsParams
): Promise<{
  content: ProjectResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
}> => {
  const {
    page = 0, size = 10, search, stage, engineerEmail,
    teamName, deadlineFrom, deadlineTo, sortBy = "createdAt", sortDir = "desc",
  } = params;

  const q: Record<string, string | number> = { page, size, sortBy, sortDir };
  if (search?.trim())           q.search        = search.trim();
  if (stage && stage !== "ALL") q.stage         = stage;
  if (engineerEmail?.trim())    q.engineerEmail = engineerEmail.trim();
  if (teamName?.trim())         q.teamName      = teamName.trim();
  if (deadlineFrom)             q.deadlineFrom  = deadlineFrom;
  if (deadlineTo)               q.deadlineTo    = deadlineTo;

  const res = await api.get<BackendPage>("/payments/projects", { params: q });
  return {
    content:       res.data.content,
    totalElements: res.data.page.totalElements,
    totalPages:    res.data.page.totalPages,
    number:        res.data.page.number,
  };
};

// NOTE: createProject() was removed along with CreateProjectRequest —
// see the note near that interface above.

export const getProjectById = async (id: string): Promise<ProjectResponse> => {
  const res = await api.get<ProjectResponse>(`/projects/${id}`);
  return res.data;
};

export const transitionProject = async (
  id: string,
  req: ProjectTransitionRequest
): Promise<ProjectResponse> => {
  const res = await api.patch<ProjectResponse>(`/projects/${id}/transition`, req);
  return res.data;
};

export const assignProject = async (
  id: string,
  req: AssignProjectRequest
): Promise<ProjectResponse> => {
  const res = await api.patch<ProjectResponse>(`/projects/${id}/assign`, req);
  return res.data;
};

export const getProjectVisits = async (projectId: string): Promise<VisitResponse[]> => {
  const res = await api.get<VisitResponse[]>(`/projects/${projectId}/visits`);
  return res.data;
};

export const scheduleVisit = async (
  projectId: string,
  req: ScheduleVisitRequest
): Promise<VisitResponse> => {
  const res = await api.post<VisitResponse>(`/projects/${projectId}/visit`, req);
  return res.data;
};

export const completeVisit = async (
  visitId: string,
  req: CompleteVisitRequest
): Promise<VisitResponse> => {
  const res = await api.post<VisitResponse>(`/projects/visits/${visitId}/complete`, req);
  return res.data;
};

export const rescheduleVisit = async (
  visitId: string,
  req: RescheduleVisitRequest
): Promise<VisitResponse> => {
  const res = await api.patch<VisitResponse>(`/projects/visits/${visitId}/reschedule`, req);
  return res.data;
};

export const updateProject = async (
  id: string,
  data: Partial<ProjectResponse>
): Promise<ProjectResponse> => {
  const res = await api.put<ProjectResponse>(`/projects/${id}`, data);
  return res.data;
};

export const deleteProject = async (id: string): Promise<void> => {
  await api.delete(`/projects/${id}`);
};