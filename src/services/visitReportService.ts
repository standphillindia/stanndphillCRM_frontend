// src/services/visitReportService.ts
//
// Factory-visit paperwork the engineer fills right after "Log Visit Result",
// before the visit expense:
//   1. BIS document checklist — 22 documents, each Yes / No / Not applicable.
//      Admin is notified, and the "No" documents blink red for Admin.
//   2. Basic Information Form for the BIS application. No field is mandatory.

import api from "../api/axios";

export type ChecklistStatus = "YES" | "NO" | "NA";

export const CHECKLIST_STATUS_LABEL: Record<ChecklistStatus, string> = {
  YES: "Yes",
  NO: "No",
  NA: "N.A.",
};

export interface ChecklistRow {
  no: number;
  section: string;
  document: string;
  status: ChecklistStatus | null;
  remark: string | null;
}

export interface VisitReport {
  projectId: string;
  projectName: string | null;
  // Prefill from the project.
  companyName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  certificationType: string | null;

  checklist: ChecklistRow[];
  checklistRemarks: string | null;
  factoryRepName: string | null;
  standphillRepName: string | null;
  checklistYes: number;
  checklistNo: number;
  checklistNa: number;
  checklistSubmittedAt: string | null;
  checklistSubmittedBy: string | null;

  basicInfoJson: string | null;
  basicInfoSubmittedAt: string | null;
  basicInfoSubmittedBy: string | null;
}

export interface SaveChecklistRequest {
  items: { no: number; status: ChecklistStatus; remark: string }[];
  remarks: string;
  factoryRepName: string;
  standphillRepName: string;
}

// ── Basic Information Form ─────────────────────────────────────────────

export interface PersonRow {
  name: string;
  designation: string;
  contact: string;
  email: string;
}

export interface QcPersonRow {
  name: string;
  qualification: string;
  designation: string;
  experience: string;
  contact: string;
  email: string;
}

export interface PackagingRow {
  material: string;
  description: string;
  quantity: string;
  marking: string;
  batchCode: string;
}

export interface BasicInfo {
  companyName: string;
  productIsNo: string;
  factoryAddress: string;
  emailContact: string;
  officeAddress: string;
  brandName: string;
  brandRegistered: "" | "YES" | "NO";
  scopeAsPerIs: string;
  scopeRequested: string;
  weeklyOff: string;
  topManagement: PersonRow[];
  qcPersons: QcPersonRow[];
  signatory: PersonRow;
  latitude: string;
  longitude: string;
  packaging: PackagingRow[];
  installedCapacity: string;
  producedLastYear: string;
  valueLastYear: string;
  costPerUnit: string;
}

export const emptyPerson = (): PersonRow => ({ name: "", designation: "", contact: "", email: "" });
export const emptyQcPerson = (): QcPersonRow => ({
  name: "", qualification: "", designation: "", experience: "", contact: "", email: "",
});
export const emptyPackaging = (): PackagingRow => ({
  material: "", description: "", quantity: "", marking: "", batchCode: "",
});

export const emptyBasicInfo = (): BasicInfo => ({
  companyName: "",
  productIsNo: "",
  factoryAddress: "",
  emailContact: "",
  officeAddress: "",
  brandName: "",
  brandRegistered: "",
  scopeAsPerIs: "",
  scopeRequested: "",
  weeklyOff: "",
  topManagement: [emptyPerson(), emptyPerson()],
  qcPersons: [emptyQcPerson()],
  signatory: emptyPerson(),
  latitude: "",
  longitude: "",
  packaging: [emptyPackaging()],
  installedCapacity: "",
  producedLastYear: "",
  valueLastYear: "",
  costPerUnit: "",
});

/** Saved form → BasicInfo; first time, prefilled from the project. Never throws. */
export const parseBasicInfo = (report: VisitReport | null): BasicInfo => {
  const base = emptyBasicInfo();
  if (report?.basicInfoJson) {
    try {
      const saved = JSON.parse(report.basicInfoJson) as Partial<BasicInfo>;
      return {
        ...base,
        ...saved,
        topManagement: Array.isArray(saved.topManagement) && saved.topManagement.length
          ? saved.topManagement.map((r) => ({ ...emptyPerson(), ...r })) : base.topManagement,
        qcPersons: Array.isArray(saved.qcPersons) && saved.qcPersons.length
          ? saved.qcPersons.map((r) => ({ ...emptyQcPerson(), ...r })) : base.qcPersons,
        packaging: Array.isArray(saved.packaging) && saved.packaging.length
          ? saved.packaging.map((r) => ({ ...emptyPackaging(), ...r })) : base.packaging,
        signatory: { ...emptyPerson(), ...(saved.signatory ?? {}) },
      };
    } catch {
      /* fall through to the prefill */
    }
  }
  if (report) {
    base.companyName = report.companyName ?? "";
    base.factoryAddress = report.address ?? "";
    base.emailContact = [report.email, report.phone].filter(Boolean).join(" / ");
  }
  return base;
};

export const getVisitReport = async (projectId: string) =>
  (await api.get<VisitReport>(`/visit-reports/projects/${projectId}`)).data;

export const saveVisitChecklist = async (projectId: string, req: SaveChecklistRequest) =>
  (await api.put<VisitReport>(`/visit-reports/projects/${projectId}/checklist`, req)).data;

export const saveVisitBasicInfo = async (projectId: string, info: BasicInfo) =>
  (await api.put<VisitReport>(`/visit-reports/projects/${projectId}/basic-info`, {
    data: JSON.stringify(info),
  })).data;

// ── Visits still to fill ───────────────────────────────────────────────

/** A logged factory visit (last 30 days) whose checklist / basic info is not filled yet. */
export interface PendingVisitReport {
  projectId: string;
  projectName: string | null;
  engineerName: string | null;
  visitLoggedAt: string | null;
  checklistDone: boolean;
  basicInfoDone: boolean;
}

export const getPendingVisitReports = async () =>
  (await api.get<PendingVisitReport[]>("/visit-reports/pending")).data;