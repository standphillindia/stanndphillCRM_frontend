// src/pages/users/UsersPage.tsx
// Standphill CRM — Users page
// Frontend-only for now: userService.ts uses mock data internally.
// Once backend is ready, only src/services/userService.ts needs to change
// (flip USE_MOCK_DATA to false) — nothing in this file needs to be touched.

import { useEffect, useState, useMemo } from "react";
import {
  fetchUsers,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  type UserResponse,
  type CreateUserRequest,
} from "../../services/userService";
import {
  USER_ROLES,
  USER_STATUSES,
  USER_TEAMS,
  USER_DEPARTMENTS,
  type UserRole,
  type UserStatus,
} from "../../constants/userConstants";
import UserProfileDrawer from "./components/UserProfileDrawer";
import RolePermissionsPanel from "./components/RolePermissionsPanel";

// ── Role badge config 

const ROLE_CONFIG: Record<
  UserRole,
  { bg: string; text: string; border: string; label: string }
> = {
  ADMIN:     { bg: "bg-tertiary/10",   text: "text-tertiary",    border: "border-tertiary/20",    label: "Admin" },
  MANAGER:   { bg: "bg-primary/10",    text: "text-primary",     border: "border-primary/20",     label: "Manager" },
  ENGINEER:  { bg: "bg-purple-500/10", text: "text-purple-700",  border: "border-purple-500/20",  label: "Engineer" },
  SALES:     { bg: "bg-amber-500/10",  text: "text-amber-700",   border: "border-amber-500/20",   label: "Sales" },
  SUPPORT:   { bg: "bg-green-500/10",  text: "text-green-700",   border: "border-green-500/20",   label: "Support" },
  ACCOUNTANT: { bg: "bg-blue-500/10",   text: "text-blue-700",    border: "border-blue-500/20",    label: "Accountant" },
  FINANCE:   { bg: "bg-indigo-500/10", text: "text-indigo-700",  border: "border-indigo-500/20",  label: "Finance" },
};

const STATUS_CONFIG: Record<
  UserStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  ACTIVE:   { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/20", label: "Active" },
  INACTIVE: { bg: "bg-error/10",       text: "text-error",       border: "border-error/20",       label: "Inactive" },
  INVITED:  { bg: "bg-surface-container-highest/60", text: "text-secondary", border: "border-outline-variant/30", label: "Invited" },
};

// ── Avatar helpers 

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-tertiary/20 text-tertiary",
  "bg-secondary-container text-on-secondary-container",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Empty form ────────────────────────────────────────────────────────────────

const EMPTY_FORM: CreateUserRequest = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "ENGINEER",
  team: "OpsA",
  department: "Operations",
};

// ── Modal wrapper ──────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 bg-surface border border-outline-variant/30 rounded-lg " +
  "text-body-md text-on-surface outline-none " +
  "focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-secondary-fixed/60 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<"members" | "permissions">("members");

  const [users,   setUsers]   = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Profile drawer
  const [profileUser, setProfileUser] = useState<UserResponse | null>(null);

  // Filters
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState<UserRole | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "ALL">("ALL");
  const [showFilters,  setShowFilters]  = useState(false);

  // Create modal
  const [showAdd,    setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState<CreateUserRequest>(EMPTY_FORM);
  const [addError,   setAddError]   = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editUser,    setEditUser]    = useState<UserResponse | null>(null);
  const [editForm,    setEditForm]    = useState<CreateUserRequest>(EMPTY_FORM);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Reset password modal ──────────────────────────────────────────────────
  const [resetPasswordUser, setResetPasswordUser] = useState<UserResponse | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Status toggle inline
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadUsers = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await fetchUsers({
        search: search || undefined,
        role: roleFilter,
        status: statusFilter,
      });
      setUsers(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPageError(err?.message ?? "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => loadUsers(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, statusFilter]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true); setAddError(null);
    try {
      await createUser(addForm);
      setShowAdd(false); setAddForm(EMPTY_FORM); loadUsers();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setAddError(err?.message ?? "Failed to create user.");
    } finally { setAddLoading(false); }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (user: UserResponse) => {
    setEditUser(user);
    setEditForm({
      fullName: user.fullName,
      email: user.email,
      phone: user.phone ?? "",
      role: user.role,
      team: user.team ?? "OpsA",
      department: user.department ?? "Operations",
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true); setEditError(null);
    try {
      await updateUser(editUser.id, editForm);
      setEditUser(null); loadUsers();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setEditError(err?.message ?? "Failed to update user.");
    } finally { setEditLoading(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try { await deleteUser(deleteId); setDeleteId(null); loadUsers(); }
    catch { /* ignore */ }
    finally { setDeleteLoading(false); }
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const closeResetPassword = () => {
    setResetPasswordUser(null);
    setResetPasswordValue("");
    setResetPasswordError(null);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser) return;
    if (resetPasswordValue.length < 8) {
      setResetPasswordError("Password must be at least 8 characters.");
      return;
    }
    setResetPasswordLoading(true);
    setResetPasswordError(null);
    try {
      await resetUserPassword(resetPasswordUser.id, resetPasswordValue);
      closeResetPassword();
      loadUsers();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setResetPasswordError(err?.message ?? "Failed to reset password.");
    } finally {
      setResetPasswordLoading(false);
    }
  };

  // ── Status toggle ──────────────────────────────────────────────────────────
  const handleStatusToggle = async (user: UserResponse) => {
    const next: UserStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusLoading(user.id);
    try {
      await toggleUserStatus(user.id, next);
      loadUsers();
    } finally {
      setStatusLoading(null);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter((u) => u.status === "ACTIVE").length,
    invited:  users.filter((u) => u.status === "INVITED").length,
    inactive: users.filter((u) => u.status === "INACTIVE").length,
  }), [users]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1440px] mx-auto space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-lg font-semibold text-on-surface">Users</h3>
          <p className="text-body-md text-secondary mt-0.5">
            {loading ? "Loading…" : `${users.length} team members`}
          </p>
        </div>
        <button
          onClick={() => { setAddForm(EMPTY_FORM); setAddError(null); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
            rounded-lg text-body-md font-semibold shadow-sm
            hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Add User
        </button>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-outline-variant/20">
        {[
          { key: "members" as const,     label: "Team Members",      icon: "group" },
          { key: "permissions" as const, label: "Roles & Permissions", icon: "admin_panel_settings" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-body-sm font-semibold border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "permissions" ? (
        <RolePermissionsPanel />
      ) : (
      <>
      {/* ── Search + filter bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name, email…"
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30
              rounded-lg text-body-md text-on-surface outline-none
              focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="md:col-span-8 flex flex-wrap items-center gap-3">
          <div
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
              border text-body-sm font-semibold transition-colors
              ${showFilters
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container"
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters{(roleFilter !== "ALL" || statusFilter !== "ALL") ? " (active)" : ""}
          </div>

          {showFilters && (
            <>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as UserRole | "ALL")}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Roles</option>
                {USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as UserStatus | "ALL")}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                {USER_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {(roleFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  onClick={() => { setRoleFilter("ALL"); setStatusFilter("ALL"); }}
                  className="text-body-sm text-error hover:underline"
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Error bar ──────────────────────────────────────────────────────── */}
      {pageError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-error-container/40
          border border-error/20 rounded-lg text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {pageError}
          <button
            onClick={() => loadUsers()}
            className="ml-auto text-body-sm font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                {["Name", "Role", "Team", "Status", "Last Login", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-label-caps text-outline uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-3 py-16 text-secondary">
                      <span
                        className="material-symbols-outlined text-[48px] text-outline"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}
                      >
                        group_off
                      </span>
                      <p className="text-body-md">
                        No users found.
                        {search || roleFilter !== "ALL" || statusFilter !== "ALL"
                          ? " Try clearing your filters."
                          : ""}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const av  = avatarColor(user.fullName);
                  const ini = initials(user.fullName || "?");
                  const lastLogin = user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString("en-IN")
                    : "Never";
                  const roleCfg = ROLE_CONFIG[user.role];
                  const statusCfg = STATUS_CONFIG[user.status];

                  return (
                    <tr
                      key={user.id}
                      onClick={() => setProfileUser(user)}
                      className="hover:bg-primary/[0.02] transition-colors group cursor-pointer"
                    >
                      {/* Name + email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center
                              text-[12px] font-bold shrink-0 ${av}`}
                          >
                            {ini}
                          </div>
                          <div>
                            <p className="text-body-md font-semibold text-on-surface leading-tight">
                              {user.fullName}
                            </p>
                            <p className="text-[11px] text-outline mt-0.5 leading-tight">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold
                            border uppercase tracking-tight ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
                        >
                          {roleCfg.label}
                        </span>
                      </td>

                      {/* Team */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {user.team || "—"}
                      </td>

                      {/* Status (click to toggle Active/Inactive) */}
                      <td className="px-6 py-4">
                        {statusLoading === user.id ? (
                          <span className="text-body-sm text-secondary animate-pulse">Updating…</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); if (user.status !== "INVITED") handleStatusToggle(user); }}
                            disabled={user.status === "INVITED"}
                            title={user.status === "INVITED" ? "Pending invite acceptance" : "Click to toggle status"}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold
                              border uppercase tracking-tight transition-all
                              ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}
                              ${user.status === "INVITED" ? "cursor-default" : "cursor-pointer hover:opacity-70"}`}
                          >
                            {statusCfg.label}
                          </button>
                        )}
                      </td>

                      {/* Last login */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {lastLogin}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1
                          opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setResetPasswordUser(user); }}
                            title="Reset Password"
                            className="p-2 rounded-lg hover:bg-tertiary/10 text-tertiary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">key</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openEdit(user); }}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteId(user.id); }}
                            title="Delete"
                            className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mini stats bento ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: stats.total,    sub: "All members",   color: "text-primary"     },
          { label: "Active",      value: stats.active,   sub: "Currently on",  color: "text-emerald-700" },
          { label: "Invited",     value: stats.invited,  sub: "Pending",       color: "text-tertiary"    },
          { label: "Inactive",    value: stats.inactive, sub: "Disabled",      color: "text-error"       },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4">
            <p className="text-label-caps text-outline uppercase mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className={`text-headline-lg font-bold ${stat.color}`}>{stat.value}</h3>
              <span className="text-body-sm text-secondary mb-0.5">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Add User</h2>
              <p className="text-body-sm text-secondary mt-0.5">Invite a new team member</p>
            </div>
            <button
              onClick={() => setShowAdd(false)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleAdd} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon="person">
                <input
                  type="text"
                  placeholder="Rahul Sharma"
                  required
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Email" icon="mail">
                <input
                  type="email"
                  placeholder="rahul@standphill.com"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone (Optional)" icon="call">
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Password" icon="lock">
                <input
                  type="password"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  value={addForm.password}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, password: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Role" icon="admin_panel_settings">
                <select
                  required
                  value={addForm.role}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                  className={inputCls}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Team" icon="groups">
                <select
                  value={addForm.team}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, team: e.target.value }))}
                  className={inputCls}
                >
                  {USER_TEAMS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Department" icon="apartment">
                <select
                  required
                  value={addForm.department}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, department: e.target.value }))}
                  className={inputCls}
                >
                  {USER_DEPARTMENTS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {addError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {addError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {addLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                    Add User
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editUser && (
        <Modal onClose={() => setEditUser(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Edit User</h2>
              <p className="text-body-sm text-secondary mt-0.5">{editUser.email}</p>
            </div>
            <button
              onClick={() => setEditUser(null)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" icon="person">
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Email" icon="mail">
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone (Optional)" icon="call">
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Role" icon="admin_panel_settings">
                <select
                  required
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                  className={inputCls}
                >
                  {USER_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Team" icon="groups">
                <select
                  value={editForm.team}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, team: e.target.value }))}
                  className={inputCls}
                >
                  {USER_TEAMS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {editError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {editLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-xl p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span
                className="material-symbols-outlined text-[28px] text-error"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
              >
                delete
              </span>
            </div>
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">Delete this user?</h3>
            <p className="text-body-md text-secondary mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-error text-on-error
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {deleteLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password ───────────────────────────────────────────────── */}
      {resetPasswordUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeResetPassword}
        >
          <div
            className="glass-card w-full max-w-sm rounded-xl p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-tertiary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[28px] text-tertiary">key</span>
            </div>
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">Reset Password</h3>
            <p className="text-body-md text-secondary mb-1">
              {resetPasswordUser.fullName}
            </p>
            <p className="text-body-sm text-outline mb-6">{resetPasswordUser.email}</p>

            <input
              type="text"
              autoFocus
              value={resetPasswordValue}
              onChange={(e) => setResetPasswordValue(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full px-3 py-2.5 mb-2 bg-surface border border-outline-variant/30
                rounded-lg text-body-md text-on-surface outline-none text-center
                focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />

            {resetPasswordError && (
              <p className="text-body-sm text-error mb-3">{resetPasswordError}</p>
            )}

            <p className="text-body-sm text-outline mb-6">
              This also activates the account, so an INVITED user can log in immediately.
            </p>

            <div className="flex justify-center gap-3">
              <button
                onClick={closeResetPassword}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetPasswordLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {resetPasswordLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">key</span>
                    Set Password
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {profileUser && (
        <UserProfileDrawer
          user={profileUser}
          onClose={() => setProfileUser(null)}
          onEdit={(user) => { setProfileUser(null); openEdit(user); }}
        />
      )}

    </div>
  );
}