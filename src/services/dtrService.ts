// src/services/dtrService.ts
//
// DTR — Daily Task Report. Same columns as the team's Google Sheet:
// Task Assigned / Planned · Status · Pending Work with Reason · Remarks.
// Dates are "yyyy-MM-dd" (India time on the server).

import api from "../api/axios";

export type DtrItemStatus = "COMPLETED" | "IN_PROGRESS" | "PENDING";

export interface DtrItem {
  task: string;
  status: DtrItemStatus;
  pendingReason?: string | null;
  remarks?: string | null;
  /** Set when the row came from a CRM suggestion. */
  sourceKey?: string | null;
}

export interface DtrDay {
  id: string | null;
  date: string;
  status: "NOT_STARTED" | "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  editable: boolean;
  editableUntil: string | null;
  reviewComment: string | null;
  reviewCommentBy: string | null;
  reviewCommentAt: string | null;
  items: DtrItem[];
  userId: string;
  userName: string | null;
  userEmail: string | null;
  department: string | null;
  role: string | null;
}

export interface DtrSuggestion {
  key: string;
  text: string;
}

export interface TeamDtrRow {
  userId: string;
  name: string;
  email: string;
  department: string | null;
  role: string | null;
  status: "NOT_FILLED" | "DRAFT" | "SUBMITTED";
  submittedAt: string | null;
  tasks: number;
  completed: number;
  pending: number;
}

export interface TeamDtr {
  date: string;
  team: number;
  submitted: number;
  draft: number;
  notFilled: number;
  rows: TeamDtrRow[];
}

export interface DtrTodayStatus {
  date: string;
  status: "NOT_STARTED" | "DRAFT" | "SUBMITTED";
  tasks: number;
  submittedAt: string | null;
  suggestions: number;
}

/** Today in India, as yyyy-MM-dd. */
export const todayIst = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

export const getMyDtr = async (date?: string): Promise<DtrDay> =>
  (await api.get<DtrDay>("/dtr/my", { params: date ? { date } : {} })).data;

export const saveMyDtr = async (date: string, items: DtrItem[], submit: boolean): Promise<DtrDay> =>
  (await api.put<DtrDay>("/dtr/my", { date, items, submit })).data;

export const getMySuggestions = async (date?: string): Promise<DtrSuggestion[]> =>
  (await api.get<DtrSuggestion[]>("/dtr/my/suggestions", { params: date ? { date } : {} })).data;

export const getMyTodayStatus = async (): Promise<DtrTodayStatus> =>
  (await api.get<DtrTodayStatus>("/dtr/my/today-status")).data;

export const getTeamDtr = async (date: string, department?: string): Promise<TeamDtr> =>
  (await api.get<TeamDtr>("/dtr/team", { params: { date, department: department || undefined } })).data;

export const getPersonDtr = async (userId: string, date: string): Promise<DtrDay> =>
  (await api.get<DtrDay>(`/dtr/team/${userId}`, { params: { date } })).data;

export const commentOnDtr = async (userId: string, date: string, comment: string): Promise<DtrDay> =>
  (await api.put<DtrDay>(`/dtr/team/${userId}/comment`, { comment }, { params: { date } })).data;

export const unlockDtr = async (userId: string, date: string): Promise<DtrDay> =>
  (await api.post<DtrDay>(`/dtr/team/${userId}/unlock`, null, { params: { date } })).data;

export const remindTeam = async (department?: string): Promise<number> =>
  (await api.post<{ sent: number }>("/dtr/team/remind", null, { params: { department: department || undefined } })).data.sent;

export interface DtrExportRow {
  date: string;
  day: string;
  name: string;
  department: string | null;
  task: string;
  status: string;
  pendingReason: string | null;
  remarks: string | null;
  dtrStatus: string;
}

export const exportTeamDtr = async (from: string, to: string, department?: string): Promise<DtrExportRow[]> =>
  (await api.get<DtrExportRow[]>("/dtr/team/export", { params: { from, to, department: department || undefined } })).data;

export const DTR_STATUS_OPTIONS: { value: DtrItemStatus; label: string }[] = [
  { value: "COMPLETED", label: "Completed" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PENDING", label: "Pending" },
];

export const DTR_STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  PENDING: "bg-amber-100 text-amber-800",
};

/** "02-Nov-2026 · Monday" */
export const prettyDtrDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  return `${date} · ${day}`;
};

export const prettyTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })
    : "—";

export const prettyDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "";