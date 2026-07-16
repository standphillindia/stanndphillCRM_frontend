// src/services/permissionService.ts
//
// Connected to the real backend now:
//   GET /api/admin/permissions          -> flat list of {roleId, roleName, module, allowed}
//   PUT /api/admin/permissions          -> body {roleId, module, allowed}, updates ONE row
//
// Backend enforces access per (role, module) only — no per-action (view/create/
// edit/delete) granularity — so the matrix here is a single Access toggle per
// module, matching what ModuleAccessFilter can actually check.

import api from "../api/axios";
import { PERMISSION_MODULES, type RolePermissionMap, type PermissionModule } from "../constants/permissionConstants";
import { USER_ROLES, type UserRole } from "../constants/userConstants";

interface PermissionRow {
  roleId: string;
  roleName: string;
  module: string;
  allowed: boolean;
}

export interface RolePermissionsData {
  // What the UI renders/toggles
  permissions: Record<UserRole, RolePermissionMap>;
  // roleName -> roleId, needed because PUT requires the DB roleId, not the name
  roleIds: Partial<Record<UserRole, string>>;
}

const emptyModuleMap = (): RolePermissionMap =>
  Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, false])) as RolePermissionMap;

// ─────────────────────────────────────────────────────────────
// GET /api/admin/permissions  →  fetch the full role → module matrix
// ─────────────────────────────────────────────────────────────
export const fetchRolePermissions = async (): Promise<RolePermissionsData> => {
  const res = await api.get<PermissionRow[]>("/admin/permissions");

  const permissions = Object.fromEntries(
    USER_ROLES.map((r) => [r.value, emptyModuleMap()])
  ) as Record<UserRole, RolePermissionMap>;

  const roleIds: Partial<Record<UserRole, string>> = {};

  for (const row of res.data) {
    const roleName = row.roleName.toUpperCase() as UserRole;
    if (!(roleName in permissions)) continue; // role not shown in this UI (e.g. custom role)

    roleIds[roleName] = row.roleId;

    const moduleKey = row.module as PermissionModule;
    if (PERMISSION_MODULES.some((m) => m.key === moduleKey)) {
      permissions[roleName][moduleKey] = row.allowed;
    }
  }

  return { permissions, roleIds };
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/permissions/mine  →  modules the CURRENT logged-in user's
// role is allowed to access. Used by the sidebar to hide nav items the
// user has no permission for (instead of showing everything and only
// blocking access after they click through).
// ─────────────────────────────────────────────────────────────
export const fetchMyModules = async (): Promise<string[]> => {
  const res = await api.get<string[]>("/admin/permissions/mine");
  return res.data;
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/permissions  →  save every module's access for one role.
// Backend only accepts one (roleId, module, allowed) row per call, so we
// fire one PUT per module in parallel.
// ─────────────────────────────────────────────────────────────
export const updateRolePermissions = async (
  roleId: string,
  modulePermissions: RolePermissionMap
): Promise<void> => {
  await Promise.all(
    PERMISSION_MODULES.map((m) =>
      api.put("/admin/permissions", {
        roleId,
        module: m.key,
        allowed: modulePermissions[m.key],
      })
    )
  );
};