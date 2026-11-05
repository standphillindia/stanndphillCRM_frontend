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
//
// NOTE ON `stage`: this is the OLD coarse-bucket ProjectStage enum. Real
// day-by-day progress now lives in the Project Stage Tracker
// (services/projectStageService.ts) — `stage` here only gets updated
// automatically at a couple of milestones (e.g. set to CLOSED when the
// tracker's final stage completes, or LICENSE_GRANTED when a certificate
// is created). Don't build new stage-transition UI against this field —
// use projectStageService instead.
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

  // ── 45-day stage tracker — the current stage to actually show in the
  // UI. `stage` above is the legacy single-enum field, kept only for
  // internal finance bookkeeping — don't display it.
  currentStageDisplayName: string | null;   // e.g. "Document Collection"
  currentStageCode: string | null;
  currentStageLate: boolean;
  currentStageDaysLateOrRemaining: number | null; // negative = days late

  // Who the project is with.
  opsPersonEmail?: string | null;
  opsPersonName?: string | null;
  engineerName?: string | null;
  // "NEW" (added after the New/Old split went live) or "OLD".
  batch?: ProjectBatch;
  // When it was added to the CRM (ISO). startDate is the project's own Day 1.
  createdAt?: string | null;
}

export type ProjectBatch = "NEW" | "OLD";

// NOTE: CreateProjectRequest / createProject() were removed — POST
// /projects no longer exists on the backend. Projects are now created
// automatically the moment a Lead goes WON (starting in DRAFT stage).
//
// NOTE: The manual stage-transition flow (transitionProject, assignProject)
// and the old engineer-visit-scheduling flow (getProjectVisits,
// scheduleVisit, completeVisit, rescheduleVisit) were removed from this
// file — they were only ever called from the old "Move Next" UI on
// ProjectsPage.tsx, which has been replaced by the day-wise Project Stage
// Tracker (see ProjectStagesPage.tsx / projectStageService.ts). The
// backend endpoints they called still exist (unused, not deleted), so
// this can be restored if that workflow is ever needed again.
//
// NOTE: updateProject / deleteProject were also removed as dead code —
// nothing in the app called them.

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
  // Projects page tab. Omit for all projects.
  batch?: ProjectBatch;
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
    teamName, deadlineFrom, deadlineTo, sortBy = "createdAt", sortDir = "desc", batch,
  } = params;

  const q: Record<string, string | number> = { page, size, sortBy, sortDir };
  if (batch)                    q.batch         = batch;
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

// Same data as fetchProjects() above, but reachable under
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

// ── Manual "Add Project" (projects already running before the CRM) ─────
// POST /api/projects/import — Admin only. The project lands in the stage
// tracker at `startGroup`: earlier groups are recorded as done, that group
// becomes active, later ones stay pending.
export type ImportScheduleMode = "FROM_TODAY" | "FROM_ORIGINAL_START";

export interface ImportProjectRequest {
  projectName?: string;
  certificationType?: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  customerPanNo?: string;
  billingAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  paymentTerms?: string;
  notes?: string;
  amount?: number;
  deadline?: string;          // yyyy-MM-dd

  engineerId?: string;
  opsPersonId?: string;
  ownerId?: string;
  departmentId?: string;

  startGroup: number;
  scheduleMode: ImportScheduleMode;
  originalStartDate?: string; // yyyy-MM-dd
  auditDate?: string;         // yyyy-MM-dd
}

export const importProject = async (req: ImportProjectRequest): Promise<ProjectResponse> => {
  const res = await api.post<ProjectResponse>("/projects/import", req);
  return res.data;
};

export const getProjectById = async (id: string): Promise<ProjectResponse> => {
  const res = await api.get<ProjectResponse>(`/projects/${id}`);
  return res.data;
};
// ── Assign Ops person / engineer ─────────────────────────────────────
// Ops stages of the tracker go to the Ops person's My Tasks, Engineer
// stages to the engineer's. Empty = leave as it is.
export interface AssignProjectsRequest {
  opsPersonEmail?: string;
  engineerEmail?: string;
}

export const assignProject = async (
  id: string,
  req: AssignProjectsRequest
): Promise<ProjectResponse> => {
  const res = await api.patch<ProjectResponse>(`/projects/${id}/assign`, req);
  return res.data;
};

export const assignProjectsBulk = async (
  projectIds: string[],
  req: AssignProjectsRequest
): Promise<ProjectResponse[]> => {
  const res = await api.patch<ProjectResponse[]>("/projects/assign-bulk", { projectIds, ...req });
  return res.data;
};

// Admin: move projects between the New and Old tabs of the Projects page.
export const moveProjectsToBatch = async (
  projectIds: string[],
  batch: ProjectBatch
): Promise<ProjectResponse[]> => {
  const res = await api.patch<ProjectResponse[]>("/projects/batch", { projectIds, batch });
  return res.data;
};

// ── Project name & client details (Admin / Operations) ──────────────────
// e.g. rename "BIS - Website Lead" to the real company once it's known.
export interface ProjectDetails {
  id: string;
  projectName: string;
  certificationType: string | null;
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  customerPanNo: string | null;
  billingAddress: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export type UpdateProjectDetailsRequest = Partial<Omit<ProjectDetails, "id" | "certificationType">>;

export const fetchProjectDetails = async (projectId: string): Promise<ProjectDetails> =>
  (await api.get<ProjectDetails>(`/projects/${projectId}/details`)).data;

export const updateProjectDetails = async (
  projectId: string,
  req: UpdateProjectDetailsRequest
): Promise<ProjectDetails> =>
  (await api.patch<ProjectDetails>(`/projects/${projectId}/details`, req)).data;
/**
 * Payments → Projects: set a project's contract (total agreed) amount by
 * hand. Received / Pending are re-worked on the server straight after.
 */
export const setProjectContractAmount = async (
  projectId: string,
  amount: number
): Promise<{ projectId: string; amount: number }> => {
  const res = await api.patch<{ projectId: string; amount: number }>(
    `/payments/projects/${projectId}/contract`,
    { amount }
  );
  return res.data;
};