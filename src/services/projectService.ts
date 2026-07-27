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
}

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

export const getProjectById = async (id: string): Promise<ProjectResponse> => {
  const res = await api.get<ProjectResponse>(`/projects/${id}`);
  return res.data;
};