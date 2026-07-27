// src/constants/permissionConstants.ts
// Defines the modules used to build the RBAC permission matrix.
//
// Backend (role_module_permissions table + ModuleAccessFilter) now enforces
// access per (role, module, action) — 4 independent flags per module:
//   canRead   -> view/list this module at all (also drives sidebar visibility)
//   canWrite  -> create new records
//   canEdit   -> update existing records
//   canDelete -> delete records

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

export interface ModuleActionFlags {
  canRead: boolean;
  canWrite: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export const PERMISSION_ACTIONS: { key: keyof ModuleActionFlags; label: string }[] = [
  { key: "canRead",   label: "Read" },
  { key: "canWrite",  label: "Write" },
  { key: "canEdit",   label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

// One set of 4 action flags per module.
export type RolePermissionMap = Record<PermissionModule, ModuleActionFlags>;
