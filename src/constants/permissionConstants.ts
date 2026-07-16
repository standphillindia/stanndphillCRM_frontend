// src/constants/permissionConstants.ts
// Defines the modules used to build the RBAC permission matrix.
//
// NOTE: Backend (role_module_permissions table + ModuleAccessFilter) enforces
// access at the MODULE level only — one "allowed" boolean per (role, module).
// It does not distinguish View/Create/Edit/Delete. So the matrix here is a
// single Access toggle per module, matching what the backend can actually
// enforce.

export const PERMISSION_MODULES = [
  { key: "LEADS",          label: "Leads",          icon: "person_search" },
  { key: "DEALS",          label: "Deals",          icon: "handshake" },
  { key: "PROJECTS",       label: "Projects",       icon: "work" },
  { key: "CERTIFICATIONS", label: "Certifications", icon: "verified" },
  { key: "PAYMENTS",       label: "Payments",       icon: "payments" },
  { key: "AMC",            label: "AMC",            icon: "shield" },
  { key: "DOCUMENTS",      label: "Documents",      icon: "description" },
  { key: "USERS",          label: "Users",          icon: "group" },
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number]["key"];

// One boolean per module — "does this role have access to this module at all".
export type RolePermissionMap = Record<PermissionModule, boolean>;