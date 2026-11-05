// src/utils/visitPermissions.ts
//
// Group 8 "Engineer Factory Visit" is shared by two teams:
//   - Operations fixes the visit date with the client (Schedule / Reschedule);
//   - the Engineer goes, then logs the result with the sample-box photo.
// Admin can do both.
// A date picked by Operations / the Engineer is a request: Admin approves it
// (same date, another date or another engineer) or cancels it before the
// visit is scheduled. A date Admin picks is scheduled straight away.
// This decides which button a person sees; the backend
// checks the same rule again (ProjectStageTrackerService.scheduleEngineerVisit
// and completeStage), so a hidden button is never the only guard.

import { decodeJwt } from "./jwt";
import { parseEngineerVisitState } from "../services/projectStageService";

export type VisitAction = "schedule" | "reschedule" | "log-result" | "approve" | "change-request" | "none";

const startsWith = (value: unknown, ...prefixes: string[]) =>
  typeof value === "string" && prefixes.some((p) => value.trim().toLowerCase().startsWith(p));

export const visitRoles = (token: string | null | undefined) => {
  const t = decodeJwt(token);
  const role = t?.role;
  const department = t?.department;
  return {
    isAdmin: role === "ADMIN",
    isOps: role === "OPERATIONS" || startsWith(department, "operation") || department === "Ops",
    isEngineer: role === "ENGINEER" || startsWith(department, "engineer"),
  };
};

/** Which visit button this person gets for a CLIENT_VISIT_ENG stage. */
export const visitActionFor = (
  token: string | null | undefined,
  validationData: string | null
): VisitAction => {
  const { isAdmin, isOps, isEngineer } = visitRoles(token);
  const status = parseEngineerVisitState(validationData).visitStatus;
  if (status === "PENDING_APPROVAL") {
    if (isAdmin) return "approve";
    return isOps || isEngineer ? "change-request" : "none";
  }
  const scheduled = status === "SCHEDULED";
  if (isAdmin || isEngineer) return scheduled ? "log-result" : "schedule";
  if (isOps) return scheduled ? "reschedule" : "schedule";
  return "none";
};

export const visitButtonLabel = (action: VisitAction): string =>
  action === "log-result"
    ? "Log Visit Result"
    : action === "reschedule"
    ? "Reschedule Visit"
    : action === "approve"
    ? "Review & Approve Visit"
    : action === "change-request"
    ? "Change Requested Date"
    : "Schedule Visit";

/** "10-Nov-2026" for an ISO date. */
export const visitDateLabel = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";