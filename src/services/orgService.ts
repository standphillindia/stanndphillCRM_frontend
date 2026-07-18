// src/services/orgService.ts
//
// Kept only for backward compatibility with existing imports
// (e.g. LeadsPage.tsx's "Mark as Won" modal). The real implementation now
// lives in orgSetupService.ts — this file just re-exports it under the
// old names, so nothing importing from "orgService" needs to change.
//
// Prefer importing from "orgSetupService" directly in any NEW code.

export {
  fetchDepartments,
  type OrgSetupOption as DepartmentResponse,
} from "./orgsetupservice";