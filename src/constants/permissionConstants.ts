// src/constants/permissionConstants.ts
// Defines the modules used to build the RBAC permission matrix.
//
// Backend (role_module_permissions table + ModuleAccessFilter) now enforces
// access per (role, module, action) — 4 independent flags per module:
//   canRead   -> view/list this module at all (also drives sidebar visibility)
//   canWrite  -> create new records
//   canEdit   -> update existing records
//   canDelete -> delete records

// pageOnly: these used to be "page access" only (just Read). All four
// actions are now checked on the server too (ModuleAccessFilter): e.g. My
// Tasks — Write = add a note, Edit = complete / submit / schedule a stage,
// Delete = remove a note; Visit Expenses — Write = submit a claim, Edit =
// approve / reject / mark paid. The flag is kept only for the small "page"
// tag next to the name.
export const PERMISSION_MODULES = [
  { key: "DASHBOARD",      label: "Dashboard",      icon: "dashboard" },
  { key: "REPORTS",        label: "Reports",        icon: "insights",          pageOnly: true },
  { key: "LEADS",          label: "Leads",          icon: "person_search" },
  { key: "LEADS_ALL",      label: "All leads",      icon: "groups_3",
    hint: "Read = see everyone's leads · Edit = edit / reassign any lead" },
  { key: "LEADS_FINANCE",  label: "Payments → Leads (pre-WON)", icon: "request_quote",
    hint: "Finance's lead list before WON" },
  { key: "DEALS",          label: "Deals",          icon: "handshake" },
  { key: "PROJECTS",       label: "Projects",       icon: "work" },
  { key: "PROJECT_DETAILS", label: "Project details & New/Old move", icon: "edit_location_alt",
    hint: "Edit client details, move projects between New and Old" },
  { key: "DELAYED_PROJECTS", label: "Delayed projects", icon: "warning",
    hint: "Admin Panel → Delayed Projects" },
  { key: "VISIT_APPROVALS", label: "Factory visit approvals", icon: "event_available",
    hint: "Read = Engineer Visits gallery · Edit = approve / cancel visit dates" },
  { key: "REAUTHORIZE",    label: "Reauthorize locked work", icon: "lock_open",
    hint: "Unlock a LATE stage or locked PI / TI access" },
  { key: "COMPLETED_PROJECTS", label: "Completed Projects", icon: "workspace_premium", pageOnly: true },
  { key: "MY_TASKS",       label: "My Tasks",       icon: "task_alt",          pageOnly: true },
  { key: "TEAM_OVERVIEW",  label: "Team overview",  icon: "monitoring",
    hint: "Team dashboard, every department's My Tasks, all urgent tasks (Edit = update any task)" },
  { key: "URGENT_TASKS",   label: "Urgent Tasks",   icon: "priority_high",     pageOnly: true },
  { key: "VISIT_EXPENSES", label: "Visit Expenses", icon: "receipt_long",      pageOnly: true },
  // Every engineer's claims. Read = see all + Excel; Edit = approve /
  // reject / mark paid / reopen / change engineer (e.g. Finance).
  { key: "VISIT_EXPENSES_REVIEW", label: "Visit Expenses — all claims", icon: "fact_check" },
  { key: "CERTIFICATIONS", label: "Certifications", icon: "verified" },
  { key: "PAYMENTS",       label: "Payments",       icon: "payments" },
  { key: "AMC",            label: "AMC",            icon: "shield" },
  { key: "DOCUMENTS",      label: "Documents",      icon: "description" },
  { key: "USERS",          label: "Users",          icon: "group",
    hint: "Edit = edit / approve / reset password · Admin accounts stay Admin-only" },
  { key: "ACTIVITY_LOG",   label: "Activity log & login time", icon: "history",
    hint: "Admin Panel → Activity Log, Login Time" },
  { key: "ADMIN_SETTINGS", label: "Settings",       icon: "settings",
    hint: "Access locks, stage setup, new departments / teams / roles. Roles & Permissions itself stays Admin-only" },
  // DTR — Daily Task Report. Read = see the page, Write = add rows,
  // Edit = save / submit. Team DTR = see everyone's (Admin, HR).
  { key: "DTR",            label: "My DTR",         icon: "edit_note" },
  { key: "DTR_TEAM",       label: "Team DTR",       icon: "groups" },
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
// Admin Panel tabs and the row each needs. The panel (and its button in
// the sidebar) shows for Admin, or for a role with Read on any of these.
export const ADMIN_PANEL_TAB_MODULE: Record<string, string> = {
  company: "ADMIN_SETTINGS",
  lookup: "ADMIN_SETTINGS",
  system: "ADMIN_SETTINGS",
  activity: "ACTIVITY_LOG",
  logintime: "ACTIVITY_LOG",
  users: "USERS",
  delayed: "DELAYED_PROJECTS",
  readytowon: "LEADS_ALL",
  engineervisits: "VISIT_APPROVALS",
  visitapprovals: "VISIT_APPROVALS",
};
// USERS alone doesn't open the panel — Users has its own page.
export const ADMIN_PANEL_MODULES = ["ADMIN_SETTINGS", "ACTIVITY_LOG", "DELAYED_PROJECTS", "LEADS_ALL", "VISIT_APPROVALS"];