// src/services/visitExpenseService.ts
//
// Engineer visit expenses. A claim opens by itself when an engineer
// factory visit is logged (completed or failed). The engineer has 3 days
// to submit it — once submitted it is final for them; Admin then
// approves / rejects / marks paid / reopens.

import api from "../api/axios";

/** Days an engineer has to submit a visit's expense (backend: VisitExpenseService.WINDOW_DAYS). */
export const EXPENSE_WINDOW_DAYS = 3;

export type ExpenseCategory = "TRAVEL" | "FOOD" | "STAY" | "COURIER" | "OTHER";
export type ExpenseStatus = "OPEN" | "EXPIRED" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; hint: string }[] = [
  { value: "TRAVEL", label: "Travel", hint: "Fuel, cab, auto, train/bus, toll, parking" },
  { value: "FOOD", label: "Food", hint: "Meals during the visit" },
  { value: "STAY", label: "Stay", hint: "Hotel / lodging" },
  { value: "COURIER", label: "Courier", hint: "Sending the sample to the lab" },
  { value: "OTHER", label: "Other", hint: "Write what it was for" },
];

export const categoryLabel = (c: string) =>
  EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export interface ExpenseItem {
  category: ExpenseCategory;
  amount: number;
  description: string | null;
}

export interface VisitExpenseClaim {
  id: string;
  projectId: string;
  projectName: string | null;
  engineerEmail: string;
  engineerName: string | null;
  visitDate: string | null;
  visitOutcome: "COMPLETED" | "FAILED" | null;
  openedAt: string;
  deadline: string;
  status: ExpenseStatus;
  canSubmit: boolean;
  items: ExpenseItem[];
  totalAmount: number | null;
  approvedAmount: number | null;
  proofUrls: string[];
  engineerNote: string | null;
  submittedAt: string | null;
  adminNote: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  paidAt: string | null;
}

export interface SubmitExpenseRequest {
  items: { category: ExpenseCategory; amount: number; description?: string }[];
  proofUrls: string[];
  note?: string;
}

// ── Engineer ──────────────────────────────────────────────────────────
export const fetchMyVisitExpenses = async (): Promise<VisitExpenseClaim[]> =>
  (await api.get<VisitExpenseClaim[]>("/visit-expenses/mine")).data;

export const submitVisitExpense = async (id: string, req: SubmitExpenseRequest): Promise<VisitExpenseClaim> =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/submit`, req)).data;

// ── Admin ─────────────────────────────────────────────────────────────
export const fetchAllVisitExpenses = async (): Promise<VisitExpenseClaim[]> =>
  (await api.get<VisitExpenseClaim[]>("/visit-expenses")).data;

export const approveVisitExpense = async (id: string, approvedAmount?: number, note?: string) =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/approve`, { approvedAmount, note })).data;

export const rejectVisitExpense = async (id: string, note: string) =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/reject`, { note })).data;

export const markVisitExpensePaid = async (id: string, note?: string) =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/paid`, { note })).data;

export const reopenVisitExpense = async (id: string, days?: number, note?: string) =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/reopen`, { days, note })).data;

/** Admin: move a claim to the engineer who actually did the visit (fresh window to submit). */
export const reassignVisitExpense = async (id: string, engineerEmail: string, days?: number) =>
  (await api.post<VisitExpenseClaim>(`/visit-expenses/${id}/reassign`, { engineerEmail, days })).data;