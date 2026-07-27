// src/services/projectStageService.ts
//
// Wraps the new day-wise Project Stage Tracker backend (see
// ProjectStageController.java / ProjectStageDefinitionController.java).
//
// Endpoints:
//   GET  /api/my-tasks?department=            (department optional — backend
//                                                infers from the logged-in
//                                                user's JWT if omitted)
//   GET  /api/projects/{id}/stages
//   POST /api/projects/{id}/stages/{stageCode}/complete
//   POST /api/projects/{id}/stages/AUDIT_SCHEDULE/submit
//   POST /api/admin/projects/{id}/stages/{stageCode}/reauthorize
//   GET  /api/admin/delayed-projects
//   GET  /api/admin/stage-definitions
//   PUT  /api/admin/stage-definitions/{id}

import api from "../api/axios";

// ── File URL resolution ───────────────────────────────────────────────
// FileUploadController.java returns a *relative* path like
// "/api/files/xyz.jpg" (deliberately host-agnostic — same code works on
// localhost or Railway). But an <img src="/api/files/xyz.jpg"> in the
// browser resolves against the *frontend's* own origin (localhost:3000),
// not the backend (localhost:2222/production API host) — so the image
// 404s. This strips the "/api" suffix off VITE_API_BASE_URL to get the
// backend's origin and prefixes relative URLs with it before rendering.
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL as string).replace(/\/api\/?$/, "");

export const resolveFileUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url; // already absolute
  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};

export type StageValidationType =
  | "CHECKBOX"
  | "PAYMENT_CONFIRM"
  | "EXTERNAL_PAYMENT_CONFIRM"
  | "DOCUMENT_UPLOAD"
  | "POPUP_FORM";

export type StageTrackerStatus = "PENDING" | "IN_PROGRESS" | "DONE" | "LATE";

export interface StageTrackerResponse {
  id: string;
  projectId: string;
  projectName: string;
  stageCode: string;
  displayName: string;
  groupOrder: number;
  responsibleDepartment: string;
  validationType: StageValidationType;
  dueDate: string | null;
  status: StageTrackerStatus;
  accessLocked: boolean;
  completedAt: string | null;
  completedByName: string | null;
  notes: string | null;
  // Negative = days late, positive = days remaining, null = no due date yet
  // (e.g. a dynamic post-audit stage whose anchor hasn't been set).
  daysLateOrRemaining: number | null;
  // Free-form JSON string — used by the engineer-visit lifecycle to store
  // {"visitStatus": "SCHEDULED"|"COMPLETED"|"FAILED", "visitDate", "photoUrl", "notes"}.
  validationData: string | null;
}

export interface CompleteStageRequest {
  notes?: string;
  validationData?: string; // free-form JSON string (e.g. uploaded doc reference)
}

export interface AuditScheduleRequest {
  visitDate: string; // yyyy-MM-dd
  clientName: string;
}

export interface EngineerVisitScheduleRequest {
  visitDate: string; // yyyy-MM-dd
}

export interface EngineerVisitCompleteRequest {
  photoUrl: string;
  notes?: string;
}

export interface EngineerVisitFailRequest {
  reason?: string;
}

// Parsed shape of a CLIENT_VISIT_ENG row's validationData JSON.
export interface EngineerVisitState {
  visitStatus: "SCHEDULED" | "COMPLETED" | "FAILED" | null;
  visitDate: string | null;
  photoUrl: string | null;
  notes: string | null;
}

export const parseEngineerVisitState = (validationData: string | null): EngineerVisitState => {
  if (!validationData) return { visitStatus: null, visitDate: null, photoUrl: null, notes: null };
  try {
    return JSON.parse(validationData);
  } catch {
    return { visitStatus: null, visitDate: null, photoUrl: null, notes: null };
  }
};

export interface ReauthorizeRequest {
  reason?: string;
}

export interface ProjectStageDefinition {
  id: string;
  stageCode: string;
  displayName: string;
  groupOrder: number;
  dayStart: number | null;
  dayEnd: number | null;
  dynamicDueDate: boolean;
  offsetFromAnchorDays: number | null;
  responsibleDepartment: string;
  validationType: StageValidationType;
  locksOpsOnLate: boolean;
  active: boolean;
}

// ── My Tasks ────────────────────────────────────────────────────────────
// Omit `department` to let the backend resolve it from the logged-in
// user's own department via the JWT (CurrentUserService) — this is the
// normal case for a department user's own dashboard. Pass it explicitly
// only for an Admin "view as department" style screen.
export const fetchMyTasks = async (department?: string): Promise<StageTrackerResponse[]> => {
  const res = await api.get<StageTrackerResponse[]>("/my-tasks", {
    params: department ? { department } : undefined,
  });
  return res.data;
};

// ── Full stage timeline for one project ───────────────────────────────
export const fetchProjectStages = async (projectId: string): Promise<StageTrackerResponse[]> => {
  const res = await api.get<StageTrackerResponse[]>(`/projects/${projectId}/stages`);
  return res.data;
};

// ── Mark a CHECKBOX / DOCUMENT_UPLOAD / EXTERNAL_PAYMENT_CONFIRM stage done ──
export const completeStage = async (
  projectId: string,
  stageCode: string,
  req?: CompleteStageRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/projects/${projectId}/stages/${stageCode}/complete`,
    req ?? {}
  );
  return res.data;
};

// ── Audit Schedule popup submit (date + client name) ─────────────────
export const submitAuditSchedule = async (
  projectId: string,
  req: AuditScheduleRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/projects/${projectId}/stages/AUDIT_SCHEDULE/submit`,
    req
  );
  return res.data;
};

// ── Engineer factory-visit — schedule / complete-with-photo / fail ────
export const scheduleEngineerVisit = async (
  projectId: string,
  req: EngineerVisitScheduleRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/projects/${projectId}/stages/CLIENT_VISIT_ENG/schedule`,
    req
  );
  return res.data;
};

export const completeEngineerVisit = async (
  projectId: string,
  req: EngineerVisitCompleteRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/projects/${projectId}/stages/CLIENT_VISIT_ENG/complete`,
    req
  );
  return res.data;
};

export const failEngineerVisit = async (
  projectId: string,
  req: EngineerVisitFailRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/projects/${projectId}/stages/CLIENT_VISIT_ENG/fail`,
    req
  );
  return res.data;
};

// Uploads a real file (the packed-sample photo) and returns a URL any
// <img> tag can render directly — see FileUploadController on the backend.
export const uploadVisitPhoto = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<{ url: string }>("/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.url;
};

// ── Admin: reauthorize Operations access after a LATE lock ───────────
export const reauthorizeStageAccess = async (
  projectId: string,
  stageCode: string,
  req?: ReauthorizeRequest
): Promise<StageTrackerResponse> => {
  const res = await api.post<StageTrackerResponse>(
    `/admin/projects/${projectId}/stages/${stageCode}/reauthorize`,
    req ?? {}
  );
  return res.data;
};

// ── Admin: every project currently flagged delayed ────────────────────
export const fetchDelayedProjects = async (): Promise<
  { id: string; projectName: string; isDelayed: boolean; stage: string }[]
> => {
  const res = await api.get("/admin/delayed-projects");
  return res.data;
};

// ── Admin: gallery of every engineer factory-visit (scheduled / done /
// failed) across all projects, newest first — powers the "Engineer
// Visits" tab in Admin Panel so photos don't have to be hunted down
// project by project. ─────────────────────────────────────────────────
export const fetchEngineerVisits = async (): Promise<StageTrackerResponse[]> => {
  const res = await api.get<StageTrackerResponse[]>("/admin/engineer-visits");
  return res.data;
};

// ── Admin: stage-definition config (day offsets, department, order) ──
export const fetchStageDefinitions = async (): Promise<ProjectStageDefinition[]> => {
  const res = await api.get<ProjectStageDefinition[]>("/admin/stage-definitions");
  return res.data;
};

export const updateStageDefinition = async (
  id: string,
  update: Partial<ProjectStageDefinition>
): Promise<ProjectStageDefinition> => {
  const res = await api.put<ProjectStageDefinition>(`/admin/stage-definitions/${id}`, update);
  return res.data;
};