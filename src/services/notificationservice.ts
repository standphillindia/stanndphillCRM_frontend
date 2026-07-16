// src/services/notificationService.ts

import api from "../api/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationType = 
  | "TASK_OVERDUE"
  | "PAYMENT_OVERDUE"
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
  | "DEAL_CREATED"
  | "DEAL_STAGE_CHANGED"
  | "PROJECT_CREATED"
  | "PROJECT_STAGE_CHANGED"
  | "CERTIFICATION_CREATED";

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
  DEAL_CREATED: "Deal Created",
  DEAL_STAGE_CHANGED: "Deal Updated",
  PROJECT_CREATED: "Project Created",
  PROJECT_STAGE_CHANGED: "Project Closed",
  CERTIFICATION_CREATED: "Certification Added",
};

// ── COLOR MAPPING ──────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, { bg: string; color: string }> = {
  TASK_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
  PAYMENT_OVERDUE: { bg: "#fef2f2", color: "#dc2626" },
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
  DEAL_CREATED: { bg: "#d1fae5", color: "#059669" },
  DEAL_STAGE_CHANGED: { bg: "#fef3c7", color: "#d97706" },
  PROJECT_CREATED: { bg: "#d1fae5", color: "#059669" },
  PROJECT_STAGE_CHANGED: { bg: "#d1fae5", color: "#059669" },
  CERTIFICATION_CREATED: { bg: "#fef3c7", color: "#d97706" },
};

// ── ICON MAPPING ───────────────────────────────────────────────────────────────

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
  TASK_OVERDUE: "⏰",
  PAYMENT_OVERDUE: "💳",
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
  DEAL_CREATED: "🤝",
  DEAL_STAGE_CHANGED: "📈",
  PROJECT_CREATED: "🚀",
  PROJECT_STAGE_CHANGED: "✅",
  CERTIFICATION_CREATED: "🎓",
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