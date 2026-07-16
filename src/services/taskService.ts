// src/services/taskService.ts
// Matches TaskController.java, TaskResponse.java, CreateTaskRequest.java, TaskTransitionRequest.java

import api from "../api/axios";

// ─────────────────────────────────────────────────────────────
// Types matching backend DTOs exactly
// ─────────────────────────────────────────────────────────────

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";

// Matches TaskResponse.java record
export interface TaskResponse {
  id: string;
  taskName: string;
  dueDate: string | null;
  status: TaskStatus;
  projectId: string;
  assignedToEmail: string;
  remarks?: string;
}

// Matches CreateTaskRequest.java record
export interface CreateTaskRequest {
  taskName: string;
  dueDate: string; // LocalDate → ISO string "YYYY-MM-DD"
  remarks: string;
  projectId: string;
  assignedToEmail: string;
}

// Filter params matching TaskController /filter endpoint
export interface TaskFilterParams {
  status?: TaskStatus;
  assignedToEmail?: string;
  projectId?: string;
  dueBefore?: string;
  dueAfter?: string;
  search?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

// Shape returned by Spring's Page<T> with VIA_DTO serialization
interface BackendPage {
  content: TaskResponse[];
  page?: {
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
  };
  // Legacy flat shape
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export interface PagedTasks {
  content: TaskResponse[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ─────────────────────────────────────────────────────────────
// API Functions
// ─────────────────────────────────────────────────────────────

// GET /api/tasks/filter
export const fetchTasks = async (
  params: TaskFilterParams = {}
): Promise<PagedTasks> => {
  const { page = 0, size = 10, sortBy = "createdAt", sortDir = "desc", ...rest } = params;

  const queryParams: Record<string, string | number> = { page, size, sortBy, sortDir };

  if (rest.status) queryParams.status = rest.status;
  if (rest.assignedToEmail?.trim()) queryParams.assignedToEmail = rest.assignedToEmail.trim();
  if (rest.projectId?.trim()) queryParams.projectId = rest.projectId.trim();
  if (rest.dueBefore) queryParams.dueBefore = rest.dueBefore;
  if (rest.dueAfter) queryParams.dueAfter = rest.dueAfter;
  if (rest.search?.trim()) queryParams.search = rest.search.trim();

  const res = await api.get<BackendPage>("/tasks/filter", { params: queryParams });
  const d = res.data;

  // Handle both nested page shape and flat shape
  const totalElements = d.page?.totalElements ?? d.totalElements ?? 0;
  const totalPages = d.page?.totalPages ?? d.totalPages ?? 0;
  const number = d.page?.number ?? d.number ?? 0;
  const sz = d.page?.size ?? d.size ?? size;

  return {
    content: d.content,
    totalElements,
    totalPages,
    number,
    size: sz,
  };
};

// GET /api/tasks/admin  (ADMIN role only)
export const getAllTasksAdmin = async (): Promise<TaskResponse[]> => {
  const res = await api.get<TaskResponse[]>("/tasks/admin");
  return res.data;
};

// GET /api/tasks/my  (ENGINEER role only)
export const getMyTasks = async (): Promise<TaskResponse[]> => {
  const res = await api.get<TaskResponse[]>("/tasks/my");
  return res.data;
};

// POST /api/tasks
export const createTask = async (
  data: CreateTaskRequest
): Promise<TaskResponse> => {
  const res = await api.post<TaskResponse>("/tasks", data);
  return res.data;
};

// PATCH /api/tasks/{id}/transition
// Valid transitions: OPEN → IN_PROGRESS | BLOCKED; IN_PROGRESS → DONE | BLOCKED; BLOCKED → IN_PROGRESS
export const transitionTask = async (
  id: string,
  targetStatus: TaskStatus
): Promise<TaskResponse> => {
  const res = await api.patch<TaskResponse>(`/tasks/${id}/transition`, {
    targetStatus,
  });
  return res.data;
};
