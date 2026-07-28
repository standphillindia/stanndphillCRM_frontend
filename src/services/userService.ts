// src/services/userService.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WORKS (read this before touching UsersPage.tsx)
// ─────────────────────────────────────────────────────────────────────────────
// Backend for /api/users is NOT ready yet. So every exported function below
// has TWO implementations:
//
//   1. A MOCK implementation (active right now) that reads/writes an in-memory
//      array and fakes network latency with a small delay.
//   2. A REAL implementation (commented out, right below the mock) that is
//      already wired to call the real endpoint via the shared `api` axios
//      instance — same pattern as leadService.ts / paymentService.ts.
//
// WHEN THE BACKEND IS READY:
//   1. Confirm the real endpoint paths/payloads match the commented code
//      (adjust the URL strings if your backend uses different routes).
//   2. Flip `USE_MOCK_DATA` below to `false`.
//   3. Delete (or leave, doesn't matter) the mock blocks.
//
// UsersPage.tsx NEVER needs to change — it only imports the exported function
// names and types from this file, exactly like it would with a real service.
// ─────────────────────────────────────────────────────────────────────────────

import api from "../api/axios";
import type { UserRole, UserStatus } from "../constants/userConstants";

const USE_MOCK_DATA = true; // ← flip this to false once /api/users is live

// ─────────────────────────────────────────────────────────────
// Types matching (expected) backend DTOs
// ─────────────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  team?: string;
  department?: string;
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  // Optional here because this type is reused for the Edit form too, which
  // never asks for a password. The Add-user form still marks its password
  // input as `required` in the JSX, so creation can't submit without one.
  password?: string;
  phone?: string;
  role: UserRole;
  team?: string;
  department?: string;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  team?: string;
}

export interface UserFilterParams {
  search?: string;
  role?: UserRole | "ALL";
  status?: UserStatus | "ALL";
}

// Used by the profile drawer — activity log + assigned-item counts.
export interface UserActivityEntry {
  id: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface UserAssignedCounts {
  leads: number;
  deals: number;
  projects: number;
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA STORE (in-memory, resets on page refresh)
// ─────────────────────────────────────────────────────────────

let mockUsers: UserResponse[] = [
  {
    id: "u-001",
    fullName: "Rahul Sharma",
    email: "rahul@standphill.com",
    phone: "9876543210",
    role: "ADMIN",
    team: "Management",
    status: "ACTIVE",
    createdAt: "2026-01-12T09:00:00.000Z",
    lastLoginAt: "2026-07-01T10:15:00.000Z",
  },
  {
    id: "u-002",
    fullName: "Priya Verma",
    email: "priya@standphill.com",
    phone: "9876501234",
    role: "ENGINEER",
    team: "OpsA",
    status: "ACTIVE",
    createdAt: "2026-02-20T09:00:00.000Z",
    lastLoginAt: "2026-06-30T16:40:00.000Z",
  },
  {
    id: "u-003",
    fullName: "Amit Kumar",
    email: "amit@standphill.com",
    role: "SALES",
    team: "Sales",
    status: "INVITED",
    createdAt: "2026-06-28T09:00:00.000Z",
    lastLoginAt: null,
  },
  {
    id: "u-004",
    fullName: "Sneha Gupta",
    email: "sneha@standphill.com",
    phone: "9911223344",
    role: "OPERATIONS",
    team: "OpsB",
    status: "INACTIVE",
    createdAt: "2026-03-05T09:00:00.000Z",
    lastLoginAt: "2026-05-18T11:00:00.000Z",
  },
];

// ─────────────────────────────────────────────────────────────
// Shape actually returned by the backend (com.crm.org.dto.UserResponse) —
// different field names/shape than the frontend UserResponse above, so we
// map between them.
// ─────────────────────────────────────────────────────────────
interface BackendUserResponse {
  id: string;
  fullName: string;
  email: string;
  active: boolean;
  roleId?: string;
  roleName?: string;
  teamId?: string;
  teamName?: string;
  departmentId?: string;
  departmentName?: string;
  createdAt: string;
  updatedAt?: string;
}

const mapBackendUser = (u: BackendUserResponse): UserResponse => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  role: (u.roleName as UserRole) ?? "OPERATIONS",
  team: u.teamName,
  department: u.departmentName,
  status: u.active ? "ACTIVE" : "INVITED",
  createdAt: u.createdAt,
  lastLoginAt: null,
});

const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms));

// ─────────────────────────────────────────────────────────────
// GET /api/users  →  fetch all users (optionally filtered)
// ─────────────────────────────────────────────────────────────
export const fetchUsers = async (
  params: UserFilterParams = {}
): Promise<UserResponse[]> => {
  // NOTE: unlike the rest of this file, this always calls the real backend —
  // GET /api/org/users now exists and returning fake data here would hide
  // real users (like the ones created via createUser below).
  const res = await api.get<BackendUserResponse[]>("/org/users");

  let result: UserResponse[] = res.data.map(mapBackendUser);

  if (params.search) {
    const q = params.search.toLowerCase();
    result = result.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }
  if (params.role && params.role !== "ALL") {
    result = result.filter((u) => u.role === params.role);
  }
  if (params.status && params.status !== "ALL") {
    result = result.filter((u) => u.status === params.status);
  }

  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

// ─────────────────────────────────────────────────────────────
// GET /api/users/{id}
// ─────────────────────────────────────────────────────────────
export const fetchUserById = async (id: string): Promise<UserResponse> => {
  if (USE_MOCK_DATA) {
    await delay(200);
    const found = mockUsers.find((u) => u.id === id);
    if (!found) throw new Error("User not found");
    return found;
  }

  // const res = await api.get<UserResponse>(`/users/${id}`);
  // return res.data;
  throw new Error("Real /api/users/{id} endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// POST /api/users  →  create user
// ─────────────────────────────────────────────────────────────
export const createUser = async (
  data: CreateUserRequest
): Promise<UserResponse> => {
  if (!data.password) {
    throw new Error("Password is required to create a user.");
  }
  if (!data.department) {
    throw new Error("Department is required to create a user.");
  }

  // Always hits the real backend — POST /api/org/users is fully implemented.
  const res = await api.post<BackendUserResponse>("/org/users", {
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    roleName: data.role,
    teamName: data.team,
    departmentName: data.department,
  });

  // Newly created users come back as PENDING/inactive — an admin still
  // needs to approve them (PATCH /api/org/users/{id}/approve) before they
  // can log in.
  return mapBackendUser(res.data);
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/{id}  →  update user
// ─────────────────────────────────────────────────────────────
export const updateUser = async (
  id: string,
  data: UpdateUserRequest
): Promise<UserResponse> => {
  if (USE_MOCK_DATA) {
    await delay();
    const idx = mockUsers.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("User not found");

    mockUsers[idx] = { ...mockUsers[idx], ...data };
    return mockUsers[idx];
  }

  // const res = await api.patch<UserResponse>(`/users/${id}`, data);
  // return res.data;
  throw new Error("Real PATCH /api/users/{id} endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/{id}/status  →  activate / deactivate
// ─────────────────────────────────────────────────────────────
export const toggleUserStatus = async (
  id: string,
  status: UserStatus
): Promise<UserResponse> => {
  if (status === "ACTIVE") {
    // Real backend support: PATCH /api/org/users/{id}/approve
    const res = await api.patch<BackendUserResponse>(`/org/users/${id}/approve`);
    return mapBackendUser(res.data);
  }

  // No backend "deactivate" endpoint exists yet — falls back to mock so the
  // UI doesn't hard-crash, but this won't actually persist.
  if (USE_MOCK_DATA) {
    await delay(250);
    const idx = mockUsers.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("User not found");

    mockUsers[idx] = { ...mockUsers[idx], status };
    return mockUsers[idx];
  }

  throw new Error("Real deactivate endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/org/users/{id}/reset-password  →  admin sets a new
// password for a user (forgotten password, or an INVITED user who
// never accepted their invite). Also activates the account. Real
// endpoint only — no mock, since it's an admin-only safety action.
// ─────────────────────────────────────────────────────────────
export const resetUserPassword = async (
  id: string,
  newPassword: string
): Promise<UserResponse> => {
  const res = await api.patch<BackendUserResponse>(
    `/org/users/${id}/reset-password`,
    { newPassword }
  );
  return mapBackendUser(res.data);
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/users/{id}
// ─────────────────────────────────────────────────────────────
export const deleteUser = async (id: string): Promise<void> => {
  // Always hits the real backend — same pattern as createUser/toggleUserStatus.
  await api.delete(`/org/users/${id}`);
};

// ─────────────────────────────────────────────────────────────
// GET /api/users/{id}/activity  →  recent activity log for profile drawer
// ─────────────────────────────────────────────────────────────
export const fetchUserActivity = async (
  id: string
): Promise<UserActivityEntry[]> => {
  // Real backend endpoint — admin-only (GET /api/org/users/{id}/activity).
  // Non-admins get a 403 here; UsersPage should only render this drawer
  // for admins anyway, but the guard lives on the backend.
  const res = await api.get<UserActivityEntry[]>(`/org/users/${id}/activity`);
  return res.data;
};

// ─────────────────────────────────────────────────────────────
// GET /api/users/{id}/assigned-counts  →  leads/deals/projects assigned to user
// ─────────────────────────────────────────────────────────────
export const fetchUserAssignedCounts = async (
  id: string
): Promise<UserAssignedCounts> => {
  if (USE_MOCK_DATA) {
    await delay(300);
    const user = mockUsers.find((u) => u.id === id);
    if (!user) return { leads: 0, deals: 0, projects: 0 };

    // Mock counts derived loosely from role, just for a realistic-looking demo.
    const base = user.role === "SALES" ? 8 : user.role === "ENGINEER" ? 3 : 5;
    return {
      leads: user.role === "SALES" ? base : Math.max(0, base - 4),
      deals: user.role === "SALES" || user.role === "OPERATIONS" ? base - 2 : 0,
      projects: user.role === "ENGINEER" || user.role === "OPERATIONS" ? base : 1,
    };
  }

  // const res = await api.get<UserAssignedCounts>(`/users/${id}/assigned-counts`);
  // return res.data;
  throw new Error("Real /api/users/{id}/assigned-counts endpoint not implemented yet");
};