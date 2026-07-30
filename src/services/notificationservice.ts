// src/services/notificationService.ts

import api from "../api/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType =
  | "TASK_OVERDUE"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_RECEIVED"
  | "PROJECT_DELAYED"
  | "CERTIFICATION_RENEWAL"
  | "CERTIFICATION_RENEWAL_REMINDER"
  | "VISIT_ASSIGNED"
  | "VISIT_TOMORROW"
  | "VISIT_TODAY"
  | "VISIT_EXPIRED"
  | "TASK_COMPLETED"
  | "TASK_ASSIGNED"
  | "TASK_EXPIRED"
  | "NEW_LEAD"
  | "LEAD_FOLLOW_UP_DUE"
  | "LEAD_PI_RAISED"
  | "LEAD_PAYMENT_RECEIVED"
  | "LEAD_READY_TO_WON"
  | "DEAL_CREATED"
  | "DEAL_STAGE_CHANGED"
  | "PROJECT_CREATED"
  | "PROJECT_STAGE_CHANGED"
  | "STAGE_DUE_REMINDER"
  | "CERTIFICATION_CREATED"
  | "AMC_CREATED"
  | "AMC_ACTIVATED"
  | "AMC_VISIT_ASSIGNED"
  | "AMC_VISIT_COMPLETED"
  | "AMC_COMPLIANCE_OVERDUE"
  | "AMC_COMPLIANCE_COMPLETED"
  | "AMC_INSTALLMENT_OVERDUE"
  | "AMC_INSTALLMENT_DUE_REMINDER"
  | "ACCESS_LOCKED"
  | "ACCESS_REAUTHORIZATION_REQUESTED";

export interface CreateNotificationRequest {
  message: string;
  type: NotificationType;
  referenceId: string;
  referenceType: "DEAL" | "PROJECT" | "VISIT" | "TASK" | "PAYMENT";
  userEmail: string;
}

export interface NotificationResponse {
  id: string;
  message: string;
  type: NotificationType;
  read: boolean;
  referenceId: string;
  referenceType: string;
  userEmail: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FilterParams {
  userEmail?: string;
  read?: boolean;
  type?: NotificationType;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
}

interface PaginatedResponse {
  content: NotificationResponse[];
  page: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
}

// ── API CALLS ──────────────────────────────────────────────────────────────────

export const createNotification = async (
  data: CreateNotificationRequest
): Promise<NotificationResponse> => {
  const res = await api.post<NotificationResponse>("/notifications", data);
  return res.data;
};

export const fetchUserNotifications = async (
  email: string
): Promise<NotificationResponse[]> => {
  const res = await api.get<NotificationResponse[]>(`/notifications/${email}`);
  return res.data;
};

export const getUnreadCount = async (email: string): Promise<number> => {
  const res = await api.get<number>(`/notifications/${email}/unread-count`);
  return res.data;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (email: string): Promise<void> => {
  await api.patch(`/notifications/${email}/read-all`);
};

export const filterNotifications = async (
  params: FilterParams
): Promise<PaginatedResponse> => {
  const queryParams: Record<string, any> = {};
  
  if (params.userEmail) queryParams.userEmail = params.userEmail;
  if (params.read !== undefined) queryParams.read = params.read;
  if (params.type) queryParams.type = params.type;
  if (params.from) queryParams.from = params.from;
  if (params.to) queryParams.to = params.to;
  if (params.page !== undefined) queryParams.page = params.page;
  if (params.size) queryParams.size = params.size;
  if (params.sortBy) queryParams.sortBy = params.sortBy;
  if (params.sortDir) queryParams.sortDir = params.sortDir;

  const res = await api.get<PaginatedResponse>("/notifications/filter", {
    params: queryParams,
  });
  return res.data;
};

export const pollNotifications = async (email: string) => {
  return Promise.all([
    getUnreadCount(email),
    fetchUserNotifications(email),
  ]);
};

// ── TYPE LABELS ────────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  TASK_OVERDUE: "Task Overdue",
  PAYMENT_OVERDUE: "Payment Overdue",
  PAYMENT_RECEIVED: "Payment Received",
  PROJECT_DELAYED: "Project Status",
  CERTIFICATION_RENEWAL: "Certification",
  CERTIFICATION_RENEWAL_REMINDER: "Expiring Soon",
  VISIT_ASSIGNED: "Visit Assigned",
  VISIT_TOMORROW: "Visit Reminder",
  VISIT_TODAY: "Visit Today",
  VISIT_EXPIRED: "Visit Expired",
  TASK_COMPLETED: "Task Completed",
  TASK_ASSIGNED: "Task Assigned",
  TASK_EXPIRED: "Task Expired",
  NEW_LEAD: "New Lead",
  LEAD_FOLLOW_UP_DUE: "Follow-up Due",
  LEAD_PI_RAISED: "PI Raised",
  LEAD_PAYMENT_RECEIVED: "Payment Received",
  LEAD_READY_TO_WON: "TI Ready",
  DEAL_CREATED: "Deal Created",
  DEAL_STAGE_CHANGED: "Deal Updated",
  PROJECT_CREATED: "Project Created",
  // Reused for every stage-progress notification, not just closing — a
  // literal "Project Closed" label here was misleading on ~everything else.
  PROJECT_STAGE_CHANGED: "Project Update",
  STAGE_DUE_REMINDER: "Due Reminder",
  CERTIFICATION_CREATED: "Certification Added",
  AMC_CREATED: "AMC Created",
  AMC_ACTIVATED: "AMC Activated",
  AMC_VISIT_ASSIGNED: "AMC Visit Assigned",
  AMC_VISIT_COMPLETED: "AMC Visit Completed",
  AMC_COMPLIANCE_OVERDUE: "AMC Compliance Overdue",
  AMC_COMPLIANCE_COMPLETED: "AMC Compliance Done",
  AMC_INSTALLMENT_OVERDUE: "AMC Installment Overdue",
  AMC_INSTALLMENT_DUE_REMINDER: "AMC Installment Due",
  ACCESS_LOCKED: "Access Locked",
  ACCESS_REAUTHORIZATION_REQUESTED: "Access Requested",
};

// ── COLOR MAPPING ──────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, { bg: string; color: string }> = {
  TASK_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
  PAYMENT_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
  PAYMENT_RECEIVED: { bg: "#d1fae5", color: "#059669" },
  PROJECT_DELAYED: { bg: "#faf5ff", color: "#7c3aed" },
  CERTIFICATION_RENEWAL: { bg: "#fef3c7", color: "#d97706" },
  CERTIFICATION_RENEWAL_REMINDER: { bg: "#fee2e2", color: "#dc2626" },
  VISIT_ASSIGNED: { bg: "#dbeafe", color: "#0284c7" },
  VISIT_TOMORROW: { bg: "#fef3c7", color: "#d97706" },
  VISIT_TODAY: { bg: "#dbeafe", color: "#0284c7" },
  VISIT_EXPIRED: { bg: "#fef2f2", color: "#dc2626" },
  TASK_COMPLETED: { bg: "#dcfce7", color: "#16a34a" },
  TASK_ASSIGNED: { bg: "#dbeafe", color: "#0284c7" },
  TASK_EXPIRED: { bg: "#fef2f2", color: "#dc2626" },
  NEW_LEAD: { bg: "#e9d5ff", color: "#9333ea" },
  LEAD_FOLLOW_UP_DUE: { bg: "#fef3c7", color: "#d97706" },
  LEAD_PI_RAISED: { bg: "#dbeafe", color: "#0284c7" },
  LEAD_PAYMENT_RECEIVED: { bg: "#d1fae5", color: "#059669" },
  LEAD_READY_TO_WON: { bg: "#d1fae5", color: "#059669" },
  DEAL_CREATED: { bg: "#d1fae5", color: "#059669" },
  DEAL_STAGE_CHANGED: { bg: "#fef3c7", color: "#d97706" },
  PROJECT_CREATED: { bg: "#d1fae5", color: "#059669" },
  PROJECT_STAGE_CHANGED: { bg: "#d1fae5", color: "#059669" },
  STAGE_DUE_REMINDER: { bg: "#fef3c7", color: "#d97706" },
  CERTIFICATION_CREATED: { bg: "#fef3c7", color: "#d97706" },
  AMC_CREATED: { bg: "#d1fae5", color: "#059669" },
  AMC_ACTIVATED: { bg: "#d1fae5", color: "#059669" },
  AMC_VISIT_ASSIGNED: { bg: "#dbeafe", color: "#0284c7" },
  AMC_VISIT_COMPLETED: { bg: "#dcfce7", color: "#16a34a" },
  AMC_COMPLIANCE_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
  AMC_COMPLIANCE_COMPLETED: { bg: "#dcfce7", color: "#16a34a" },
  AMC_INSTALLMENT_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
  AMC_INSTALLMENT_DUE_REMINDER: { bg: "#fef3c7", color: "#d97706" },
  ACCESS_LOCKED: { bg: "#fef2f2", color: "#dc2626" },
  ACCESS_REAUTHORIZATION_REQUESTED: { bg: "#fef3c7", color: "#d97706" },
};

// ── ICON MAPPING ───────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  TASK_OVERDUE: "⏰",
  PAYMENT_OVERDUE: "💳",
  PAYMENT_RECEIVED: "💰",
  PROJECT_DELAYED: "📊",
  CERTIFICATION_RENEWAL: "📜",
  CERTIFICATION_RENEWAL_REMINDER: "⏰",
  VISIT_ASSIGNED: "👤",
  VISIT_TOMORROW: "📅",
  VISIT_TODAY: "📍",
  VISIT_EXPIRED: "❌",
  TASK_COMPLETED: "✅",
  TASK_ASSIGNED: "📌",
  TASK_EXPIRED: "⚠️",
  NEW_LEAD: "🆕",
  LEAD_FOLLOW_UP_DUE: "📞",
  LEAD_PI_RAISED: "📄",
  LEAD_PAYMENT_RECEIVED: "💰",
  LEAD_READY_TO_WON: "🧾",
  DEAL_CREATED: "🤝",
  DEAL_STAGE_CHANGED: "📈",
  PROJECT_CREATED: "🚀",
  PROJECT_STAGE_CHANGED: "✅",
  STAGE_DUE_REMINDER: "⏰",
  CERTIFICATION_CREATED: "🎓",
  AMC_CREATED: "🛡️",
  AMC_ACTIVATED: "🛡️",
  AMC_VISIT_ASSIGNED: "👤",
  AMC_VISIT_COMPLETED: "✅",
  AMC_COMPLIANCE_OVERDUE: "⚠️",
  AMC_COMPLIANCE_COMPLETED: "✅",
  AMC_INSTALLMENT_OVERDUE: "💳",
  AMC_INSTALLMENT_DUE_REMINDER: "📅",
  ACCESS_LOCKED: "🔒",
  ACCESS_REAUTHORIZATION_REQUESTED: "🙋",
};

// ── SAFE GETTERS (fallback agar backend se unknown/naya type aaye) ─────────────
// ✅ FIX: In inhi ko use karo direct object indexing ki jagah, taaki
// unknown type se page crash na ho.

const DEFAULT_COLOR = { bg: "#f3f4f6", color: "#374151" };
const DEFAULT_ICON = "🔔";

export const getNotificationLabel = (type?: string): string => {
  if (type && type in NOTIFICATION_TYPE_LABELS) {
    return NOTIFICATION_TYPE_LABELS[type as NotificationType];
  }
  return type || "Notification";
};

export const getNotificationColor = (type?: string): { bg: string; color: string } => {
  if (type && type in NOTIFICATION_TYPE_COLORS) {
    return NOTIFICATION_TYPE_COLORS[type as NotificationType];
  }
  return DEFAULT_COLOR;
};

export const getNotificationIcon = (type?: string): string => {
  if (type && type in NOTIFICATION_TYPE_ICONS) {
    return NOTIFICATION_TYPE_ICONS[type as NotificationType];
  }
  return DEFAULT_ICON;
};

// ── Click-through navigation ──────────────────────────────────────────
// Routes by notification TYPE first, not just referenceType — "LEAD" as a
// referenceType is shared by very different notifications (a brand new
// lead vs. a PI/TI/payment update on an existing one), and those need to
// land on different pages. Falls back to a referenceType-based guess for
// any type not explicitly listed below.
export const getNotificationLink = (
  type: string | undefined,
  referenceType: string | undefined,
  referenceId: string | undefined
): string | null => {
  if (!referenceId) return null;

  switch (type) {
    // A new/general lead event — go to the leads list, not a payment page.
    case "NEW_LEAD":
    case "LEAD_FOLLOW_UP_DUE":
    case "DEAL_CREATED":
    case "DEAL_STAGE_CHANGED":
      return `/leads`;

    // The pre-WON PI/TI/payment flow on a specific lead.
    case "LEAD_PI_RAISED":
    case "LEAD_PAYMENT_RECEIVED":
    case "LEAD_READY_TO_WON":
      return `/payments/lead/${referenceId}`;

    // Project — creation, stage progress, delays, site visits.
    case "PROJECT_CREATED":
    case "PROJECT_STAGE_CHANGED":
    case "STAGE_DUE_REMINDER":
    case "PROJECT_DELAYED":
    case "VISIT_ASSIGNED":
    case "VISIT_TOMORROW":
    case "VISIT_TODAY":
    case "VISIT_EXPIRED":
      return `/projects/${referenceId}/stages`;

    // Access-lock / reauthorization — fires for BOTH Project stages and
    // Lead PI/TI same-day deadlines now, sharing the same two types.
    // referenceType tells them apart ("PROJECT" vs "LEAD").
    case "ACCESS_LOCKED":
    case "ACCESS_REAUTHORIZATION_REQUESTED":
      if (referenceType?.toUpperCase() === "LEAD") return `/payments/lead/${referenceId}`;
      return `/projects/${referenceId}/stages`;

    // Stage-tracker tasks.
    case "TASK_COMPLETED":
    case "TASK_ASSIGNED":
    case "TASK_EXPIRED":
    case "TASK_OVERDUE":
      return `/my-tasks`;

    // Standalone project-level payments (not the pre-WON lead flow above).
    case "PAYMENT_OVERDUE":
    case "PAYMENT_RECEIVED":
      return `/payments/project/${referenceId}`;

    // Certifications — no single-record deep link exists yet, land on the list.
    case "CERTIFICATION_RENEWAL":
    case "CERTIFICATION_RENEWAL_REMINDER":
    case "CERTIFICATION_CREATED":
      return `/certifications`;

    // AMC — every AMC notification carries the AMC's own ID.
    case "AMC_CREATED":
    case "AMC_ACTIVATED":
    case "AMC_VISIT_ASSIGNED":
    case "AMC_VISIT_COMPLETED":
    case "AMC_COMPLIANCE_OVERDUE":
    case "AMC_COMPLIANCE_COMPLETED":
    case "AMC_INSTALLMENT_OVERDUE":
    case "AMC_INSTALLMENT_DUE_REMINDER":
      return `/payments/amc/${referenceId}`;

    default:
      // Unmapped type — fall back to a best-guess from referenceType alone.
      if (!referenceType) return null;
      switch (referenceType.toUpperCase()) {
        case "PROJECT":
          return `/projects/${referenceId}/stages`;
        case "LEAD":
        case "LEADS":
          return `/leads`;
        case "AMC":
          return `/payments/amc/${referenceId}`;
        case "PAYMENTS":
        case "PAYMENT":
          return `/payments/project/${referenceId}`;
        case "TASK":
        case "TASK_SUMMARY":
          return `/my-tasks`;
        case "DEALS":
        case "DEAL":
          return `/leads`;
        default:
          return null;
      }
  }
};