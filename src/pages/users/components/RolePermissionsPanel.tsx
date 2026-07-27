// src/pages/users/components/RolePermissionsPanel.tsx
// RBAC matrix — pick a role, toggle Read/Write/Edit/Delete per module, save.
// Backend enforces this per-action now: GET->canRead, POST->canWrite,
// PUT/PATCH->canEdit, DELETE->canDelete.

import { useEffect, useState } from "react";
import {
  fetchRolePermissions,
  updateRolePermissions,
  type RolePermissionsData,
} from "../../../services/permissionService";
import {
  PERMISSION_MODULES,
  PERMISSION_ACTIONS,
  type PermissionModule,
  type ModuleActionFlags,
} from "../../../constants/permissionConstants";
import { USER_ROLES, type UserRole } from "../../../constants/userConstants";

export default function RolePermissionsPanel() {
  const [data, setData] = useState<RolePermissionsData | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>("ADMIN");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchRolePermissions()
      .then(setData)
      .catch(() => setError("Could not load permissions. Please try again."))
      .finally(() => setLoading(false));
  };

  const toggleAction = (moduleKey: PermissionModule, action: keyof ModuleActionFlags) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const current = prev.permissions[activeRole][moduleKey];
      const nextFlags: ModuleActionFlags = { ...current, [action]: !current[action] };

      // Read is the master switch — turning it off means "no access to this
      // module at all", so write/edit/delete without read access don't make
      // sense and get cleared with it. Turning individual write/edit/delete
      // on implicitly requires read (you can't create/edit/delete something
      // you can't even see), so it gets switched on automatically too.
      if (action === "canRead" && !nextFlags.canRead) {
        nextFlags.canWrite = false;
        nextFlags.canEdit = false;
        nextFlags.canDelete = false;
      } else if (action !== "canRead" && nextFlags[action]) {
        nextFlags.canRead = true;
      }

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [activeRole]: {
            ...prev.permissions[activeRole],
            [moduleKey]: nextFlags,
          },
        },
      };
    });
    setDirty(true);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!data) return;
    const roleId = data.roleIds[activeRole];
    if (!roleId) {
      setError(`No role record found for ${activeRole} — cannot save.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRolePermissions(roleId, data.permissions[activeRole]);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="glass-card rounded-xl p-10 flex items-center justify-center">
        <span className="text-body-md text-secondary animate-pulse">Loading permissions…</span>
      </div>
    );
  }

  const rolePerms = data.permissions[activeRole];
  const roleMissing = !data.roleIds[activeRole];
  const isAdminRole = activeRole === "ADMIN";
  const disabled = isAdminRole || roleMissing;

  return (
    <div className="space-y-4">
      {/* Role selector tabs */}
      <div className="flex flex-wrap gap-2">
        {USER_ROLES.map((r) => (
          <button
            key={r.value}
            onClick={() => setActiveRole(r.value)}
            className={`px-4 py-2 rounded-lg text-body-sm font-semibold border transition-all
              ${activeRole === r.value
                ? "bg-primary text-on-primary border-primary"
                : "bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container"
              }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-body-sm text-red-700">
          {error}
        </div>
      )}

      {roleMissing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-body-sm text-amber-700">
          This role has no permission rows in the database yet (it will be seeded on next backend restart, or doesn't exist as a Role record). Toggles below won't save until it does.
        </div>
      )}

      {/* Matrix */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                <th className="px-6 py-4 text-label-caps text-outline uppercase tracking-wider whitespace-nowrap">
                  Module
                </th>
                {PERMISSION_ACTIONS.map((a) => (
                  <th
                    key={a.key}
                    className="px-4 py-4 text-label-caps text-outline uppercase tracking-wider text-center whitespace-nowrap"
                  >
                    {a.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {PERMISSION_MODULES.map((mod) => {
                const flags = rolePerms[mod.key];
                return (
                  <tr key={mod.key} className="hover:bg-primary/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-outline">{mod.icon}</span>
                        <span className="text-body-md font-medium text-on-surface">{mod.label}</span>
                      </div>
                    </td>
                    {PERMISSION_ACTIONS.map((a) => (
                      <td key={a.key} className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={flags[a.key]}
                          disabled={disabled || (a.key !== "canRead" && !flags.canRead)}
                          onChange={() => toggleAction(mod.key, a.key)}
                          title={
                            a.key !== "canRead" && !flags.canRead
                              ? "Enable Read first — write/edit/delete require it"
                              : undefined
                          }
                          className="w-4 h-4 rounded border-outline-variant/40 text-primary
                            focus:ring-2 focus:ring-primary/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer / save bar */}
        <div className="px-6 py-4 bg-surface-container-low/50 border-t border-outline-variant/10 flex items-center justify-between">
          <p className="text-body-sm text-secondary">
            {isAdminRole
              ? "Admin always has full access across all modules."
              : dirty
              ? "You have unsaved changes."
              : "No unsaved changes."}
          </p>
          <button
            onClick={handleSave}
            disabled={isAdminRole || roleMissing || !dirty || saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
              rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : saved ? (
              <>
                <span className="material-symbols-outlined text-[16px]">check</span>
                Saved
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">save</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
