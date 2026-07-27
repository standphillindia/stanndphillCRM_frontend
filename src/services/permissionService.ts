// src/services/permissionService.ts
//
// Connected to the real backend:
//   GET /api/admin/permissions   -> flat list of {roleId, roleName, module, canRead, canWrite, canEdit, canDelete}
//   PUT /api/admin/permissions   -> body {roleId, module, canRead, canWrite, canEdit, canDelete}, updates ONE row
//
// Backend now enforces access per (role, module, action) — GET->canRead,
// POST->canWrite, PUT/PATCH->canEdit, DELETE->canDelete — matching the
// 4-column matrix rendered here.

import api from "../api/axios";
import { PERMISSION_MODULES, type RolePermissionMap, type PermissionModule, type ModuleActionFlags } from "../constants/permissionConstants";
import { USER_ROLES, type UserRole } from "../constants/userConstants";

interface PermissionRow {
  roleId: string;
  roleName: string;
  module: string;
  canRead: boolean;
  canWrite: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface RolePermissionsData {
  // What the UI renders/toggles
  permissions: Record<UserRole, RolePermissionMap>;
  // roleName -> roleId, needed because PUT requires the DB roleId, not the name
  roleIds: Partial<Record<UserRole, string>>;
}

const emptyFlags = (): ModuleActionFlags => ({
  canRead: false,
  canWrite: false,
  canEdit: false,
  canDelete: false,
});

const emptyModuleMap = (): RolePermissionMap =>
  Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, emptyFlags()])) as RolePermissionMap;

// ─────────────────────────────────────────────────────────────
// GET /api/admin/permissions  →  fetch the full role → module → action matrix
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
      permissions[roleName][moduleKey] = {
        canRead: row.canRead,
        canWrite: row.canWrite,
        canEdit: row.canEdit,
        canDelete: row.canDelete,
      };
    }
  }

  return { permissions, roleIds };
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/permissions/mine  →  modules the CURRENT logged-in user's
// role can at least read. Used by the sidebar to hide nav items the user
// has no permission for (instead of showing everything and only blocking
// access after they click through).
// ─────────────────────────────────────────────────────────────
export const fetchMyModules = async (): Promise<string[]> => {
  const res = await api.get<string[]>("/admin/permissions/mine");
  return res.data;
};

// ─────────────────────────────────────────────────────────────
// PUT /api/admin/permissions  →  save every module's 4 action flags for one
// role. Backend only accepts one (roleId, module, ...flags) row per call,
// so we fire one PUT per module in parallel.
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
        canRead: modulePermissions[m.key].canRead,
        canWrite: modulePermissions[m.key].canWrite,
        canEdit: modulePermissions[m.key].canEdit,
        canDelete: modulePermissions[m.key].canDelete,
      })
    )
  );
};
