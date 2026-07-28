// src/layouts/main-layouts.tsx
// Standphill CRM — Main layout shell
// Sidebar + Topbar rebuilt to match the Standphill design system exactly.
// All backend wiring (services, api/axios, routes) is untouched.

import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { fetchMyModules } from "../services/permissionService";
import logo from "../assets/logo.png";
import NotificationBell from "../pages/Notification/Notoficationbell";
import { useAuth } from "../context/AuthContext";
import { getRoleFromToken } from "../utils/jwt";

// ── Nav items (matches AppRouter routes + design reference icons) ─────────────
interface NavItemConfig {
  path: string;
  label: string;
  icon: string;
  badge?: string;
  children?: NavItemConfig[];
  // Which AppModule (backend RBAC) this item requires. Omit for items that
  // should always show regardless of permission (Dashboard, Tasks — Tasks
  // has no dedicated module on the backend yet).
  module?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "dashboard",
  },
  {
    path: "/leads",
    label: "Leads",
    icon: "person_search",
    module: "LEADS",
    children: [
      {
        path: "/leads",
        label: "Sales Leads",
        icon: "people",
      },
      {
        path: "/leads/amc-leads",
        label: "AMC Leads",
        icon: "handshake",
      },
    ],
  },
  {
    path: "/projects",
    label: "Projects",
    icon: "business_center",
    module: "PROJECTS",
  },
  {
    path: "/tasks",
    label: "Tasks",
    icon: "checklist",
  },
  {
    path: "/my-tasks",
    label: "My Tasks",
    icon: "task_alt",
    // No `module` restriction — every department (Operations, Engineering,
    // Finance, Admin) needs their own stage-tracker task list; the backend
    // itself scopes the results to the logged-in user's department.
  },
  {
    path: "/payments",
    label: "Payments",
    icon: "payments",
    module: "PAYMENTS",
    children: [
      {
        path: "/payments/dashboard",
        label: "Dashboard",
        icon: "dashboard",
      },
      {
        path: "/payments/leads",
        label: "Leads",
        icon: "handshake",
      },
      {
        path: "/payments/list",
        label: "List",
        icon: "list",
      },
      {
        path: "/payments/amc",
        label: "AMC",
        icon: "security",
      },
    ],
  },
  {
    path: "/certifications",
    label: "Certifications",
    icon: "verified",
    module: "CERTIFICATIONS",
  },
  {
    path: "/users",
    label: "Users",
    icon: "manage_accounts",
    module: "USERS",
  },
  {
    path: "/amc",
    label: "AMC",
    icon: "security",
    module: "AMC",
    children: [
      {
        path: "/amc/dashboard",
        label: "Dashboard",
        icon: "dashboard",
      },
      {
        path: "/amc/list",
        label: "Contracts",
        icon: "list",
      },
      {
        path: "/amc/create",
        label: "Create AMC",
        icon: "add_circle",
      },
    ],
  },
];

// Map route → page title shown in topbar
const PAGE_TITLES: Record<string, string> = {
  "/dashboard":           "Dashboard",
  "/leads":               "Leads",
  "/leads/amc-leads":     "AMC Leads",
  "/projects":            "Projects",
  "/payments":            "Payments",
  "/payments/dashboard":  "Payment Dashboard",
  "/payments/leads":      "Leads — Pre-WON Finance",
  "/payments/list":       "Payments",
  "/payments/amc":        "AMC Payments",
  "/documents":           "Documents",
  "/certifications":      "Certifications",
  "/users":               "Users",
  "/amc":                 "AMC",
  "/amc/dashboard":       "AMC Dashboard",
  "/amc/list":            "AMC Contracts",
  "/amc/create":          "Create AMC",
  "/admin":               "Admin Panel",
};
// NOTE: userEmail used to be a module-level `const` here, evaluated once
// when this JS module first loaded — almost always BEFORE login, when
// localStorage was still empty. That froze it at the "admin@standphill.com"
// fallback for the entire session, for every user, regardless of who
// actually logged in. Non-admin users (Finance/Marketing/Engineer/Ops)
// would then have their NotificationBell ask the backend for admin's
// notifications, which correctly got rejected with AccessDeniedException.
// Fixed by reading it fresh inside the component instead (see
// SidebarContent below).
// ── Sidebar content (shared between desktop fixed + mobile drawer) ────────────
function SidebarContent({
  onNavClick,
}: {
  onNavClick?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const isAdmin = getRoleFromToken(token) === "ADMIN";
  const [loggingOut, setLoggingOut] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Modules the logged-in user's role is allowed to access — null while
  // still loading (render nothing extra, avoid a flash of items that then
  // disappear). ADMIN gets every module back from the backend already.
  const [allowedModules, setAllowedModules] = useState<string[] | null>(null);

  useEffect(() => {
    fetchMyModules()
      .then(setAllowedModules)
      .catch(() => setAllowedModules([])); // fail closed — show only the always-visible items
  }, []);

  const visibleNavItems = (
    allowedModules === null ? [] : NAV_ITEMS
  ).filter((item) => !item.module || allowedModules!.includes(item.module));

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    navigate("/login");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);
  const toggleExpand = (path: string) => {
    setExpandedItems((prev) =>
      prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path]
    );
  };

  const renderNavItem = (item: NavItemConfig) => {
    const hasChildren = item.children && item.children.length > 0;
    const itemActive = isActive(item.path);
    const itemExpanded = expandedItems.includes(item.path);

    if (hasChildren) {
      return (
        <div key={item.path}>
          <button
            onClick={() => toggleExpand(item.path)}
            className={[
              "w-full relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 rounded-sm group",
              itemActive
                ? "border-l-4 border-primary bg-primary/8 text-primary font-semibold"
                : "border-l-4 border-transparent text-secondary hover:text-primary hover:bg-secondary-container/20",
            ].join(" ")}
          >
            <span
              className={[
                "material-symbols-outlined text-[22px] shrink-0 transition-colors",
                itemActive
                  ? "text-primary"
                  : "text-outline group-hover:text-primary",
              ].join(" ")}
              style={{
                fontVariationSettings: itemActive
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              {item.icon}
            </span>
            <span className="text-[14px] font-medium flex-1 truncate">
              {item.label}
            </span>
            <span
              className={[
                "material-symbols-outlined text-[18px] shrink-0 transition-transform",
                itemExpanded ? "rotate-180" : "",
              ].join(" ")}
            >
              expand_more
            </span>
          </button>

          {itemExpanded && (
            <div className="pl-6 space-y-0.5 py-1">
              {item.children?.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={onNavClick}
                  className={({ isActive }) =>
                    [
                      "relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 rounded-sm group text-[13px]",
                      isActive
                        ? "border-l-4 border-primary bg-primary/8 text-primary font-semibold"
                        : "border-l-4 border-transparent text-secondary hover:text-primary hover:bg-secondary-container/20",
                    ].join(" ")
                  }
                >
                  {({ isActive: childActive }) => (
                    <>
                      <span
                        className={[
                          "material-symbols-outlined text-[18px] shrink-0 transition-colors",
                          childActive
                            ? "text-primary"
                            : "text-outline group-hover:text-primary",
                        ].join(" ")}
                        style={{
                          fontVariationSettings: childActive
                            ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                            : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                        }}
                      >
                        {child.icon}
                      </span>
                      <span className="flex-1 truncate">{child.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavClick}
        className={({ isActive }) =>
          [
            "relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 rounded-sm group",
            isActive
              ? "border-l-4 border-primary bg-primary/8 text-primary font-semibold"
              : "border-l-4 border-transparent text-secondary hover:text-primary hover:bg-secondary-container/20",
          ].join(" ")
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                "material-symbols-outlined text-[22px] shrink-0 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-outline group-hover:text-primary",
              ].join(" ")}
              style={{
                fontVariationSettings: isActive
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
            >
              {item.icon}
            </span>
            <span className="text-[14px] font-medium flex-1 truncate">
              {item.label}
            </span>
            {item.badge && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full leading-none">
                {item.badge}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Brand ──────────────────────────────────────────────────────────── */}
      <div className="px-6 py-7 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 shrink-0">
            <img
              src={logo}
              alt="Standphill"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="leading-none">
            <p className="text-[18px] font-bold text-primary tracking-tight leading-tight">
              Standphill
            </p>
            <p className="text-[11px] font-semibold text-secondary tracking-widest uppercase mt-0.5">
              CRM
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {visibleNavItems.map((item) => renderNavItem(item))}
      </nav>

      {/* ── User card + logout ─────────────────────────────────────────────── */}
      <div className="p-4 mt-auto border-t border-outline-variant/10 space-y-2">
        {/* User card — click to open Admin Panel. Admin-only: it's a
            shortcut into the Admin Panel, not a personal profile card, so
            other roles shouldn't see it at all. */}
        {isAdmin && (
          <button
            onClick={() => navigate("/admin")}
            className={`w-full glass-card rounded-xl p-3 flex items-center gap-3 text-left
              transition-colors hover:bg-primary/5 cursor-pointer
              ${isActive("/admin") ? "ring-2 ring-primary/30 bg-primary/5" : ""}`}
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-[13px] font-bold text-primary">A</span>
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-on-surface truncate leading-tight">
                Admin
              </p>
              <p className="text-[11px] text-secondary truncate leading-tight mt-0.5">
                Standphill CRM
              </p>
            </div>
            <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
              admin_panel_settings
            </span>
          </button>
        )}

        {/* Sign out */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-sm text-[14px] font-medium
            text-secondary hover:bg-error-container/40 hover:text-error
            transition-colors duration-150 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[20px] shrink-0">logout</span>
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// ── Main layout ────────────────────────────────────────────────────────────────
export default function MainLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Read fresh on every mount (and whenever the route changes, e.g. right
  // after login redirects here) instead of the old module-level constant
  // that froze at whatever localStorage had at first JS load — almost
  // always before login. No fallback to a hardcoded admin email anymore;
  // if it's genuinely missing, NotificationBell just won't have anything
  // to fetch for, which is safer than silently impersonating admin.
  const [userEmail, setUserEmail] = useState(
    () => localStorage.getItem("userEmail") || ""
  );

  useEffect(() => {
    setUserEmail(localStorage.getItem("userEmail") || "");
  }, [location.pathname]);

  const pageTitle =
    PAGE_TITLES[location.pathname] ??
    Object.entries(PAGE_TITLES).find(([k]) =>
      location.pathname.startsWith(k)
    )?.[1] ??
    "Dashboard";

  useEffect(() => {
    document.title = `${pageTitle} | Standphill CRM`;
  }, [pageTitle]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar — desktop fixed, mobile drawer ────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 w-60 flex flex-col",
          "bg-surface/80 backdrop-blur-md",
          "border-r border-outline-variant/10 shadow-sm",
          "transform transition-transform duration-200 ease-in-out",
          "lg:relative lg:translate-x-0 lg:flex",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* ── Right side: topbar + page content ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="sticky top-0 z-40 h-16 shrink-0
          bg-surface/70 backdrop-blur-xl
          border-b border-outline-variant/10
          flex items-center justify-between
          px-4 lg:px-8 gap-4">

          {/* Left: hamburger (mobile) + page title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-full hover:bg-surface-container-high/50 transition-all text-on-surface-variant"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <NotificationBell userEmail={userEmail} />
                    {/* <button
                      style={{
                        padding: "8px 12px",
                        background: "none",
                        border: "none",
                        fontSize: "20px",
                        cursor: "pointer",
                        color: "#6b7280",
                      }}
                    >
                      ⚙️
                    </button> */}
                  </div>
          
          {/* <div className="flex items-center gap-1">
            
            <div className="hidden md:flex items-center gap-2
              bg-surface-container-low px-3 py-1.5
              rounded-full border border-outline-variant/20
              focus-within:ring-2 focus-within:ring-primary/40
              transition-all">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search data..."
                className="bg-transparent border-none outline-none text-[14px]
                  text-on-surface placeholder:text-secondary w-36 focus:w-48
                  transition-all duration-200"
              />
            </div>

           
            <button className="relative p-2 rounded-full hover:bg-surface-container-high/50 transition-all text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
             
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface" />
            </button>

            
            <button className="p-2 rounded-full hover:bg-surface-container-high/50 transition-all text-on-surface-variant">
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>
          </div> */}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-4 lg:px-10 py-8">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav bar ─────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full
        bg-surface/80 backdrop-blur-xl
        border-t border-outline-variant/10
        flex justify-around items-center px-4 py-2
        z-50 rounded-t-xl shadow-lg">
        {[
          { path: "/dashboard", icon: "dashboard" },
          { path: "/leads",     icon: "person_search" },
          { path: "/projects",  icon: "business_center" },
          { path: "/payments",  icon: "payments" },
        ].map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              [
                "flex flex-col items-center justify-center p-2 rounded-full transition-all active:scale-90",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-variant/30",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <span
                className="material-symbols-outlined text-[22px]"
                style={{
                  fontVariationSettings: isActive
                    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                }}
              >
                {item.icon}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}