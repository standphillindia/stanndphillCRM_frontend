import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { logoutUser } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Users,
  Folder,
  LogOut,
  Menu,
  X,
  Shield,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  to: string;
  icon: React.ComponentType<{ size: number }>;
  label: string;
  children?: NavItem[];
}

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
  },
  {
    to: "/leads",
    icon: Users,
    label: "Leads",
  },
  {
    to: "/projects",
    icon: Folder,
    label: "Projects",
  },
  
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    children: [
      {
        to: "/payments/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
      },
      {
        to: "/payments/list",
        icon: Users,
        label: "List",
      },
    ],
  },
  {
    to: "/amc",
    icon: Shield,
    label: "AMC",
  },
];

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const handleLogout = async () => {
    await logoutUser();
    logout(); // updates AuthContext state right away
    navigate("/login");
  };

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    setExpandedItems((prev) =>
      prev.includes(path)
        ? prev.filter((item) => item !== path)
        : [...prev, path]
    );
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  const isExpanded = (path: string) => expandedItems.includes(path);

  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const itemActive = isActive(item.to);
    const itemExpanded = isExpanded(item.to);

    return (
      <div key={item.to}>
        {hasChildren ? (
          <>
            <button
              onClick={(e) => toggleExpand(item.to, e)}
              className={`nav-item dropdown-toggle ${
                itemActive ? "active" : ""
              }`}
              title={collapsed ? item.label : undefined}
              style={{
                paddingLeft: `${level * 16 + 10}px`,
              }}
            >
              <item.icon size={18} />
              {!collapsed && (
                <>
                  <span>{item.label}</span>
                  <ChevronDown
                    size={16}
                    className={`ml-auto chevron-icon ${
                      itemExpanded ? "expanded" : ""
                    }`}
                  />
                </>
              )}
            </button>

            {itemExpanded && !collapsed && (
              <div className="dropdown-children">
                {item.children?.map((child) => (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    className={({ isActive }) =>
                      `nav-item child-item ${isActive ? "active" : ""}`
                    }
                    style={{
                      paddingLeft: `${(level + 1) * 16 + 10}px`,
                    }}
                  >
                    <child.icon size={16} />
                    <span>{child.label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </>
        ) : (
          <NavLink
            to={item.to}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""}`
            }
            title={collapsed ? item.label : undefined}
            style={{
              paddingLeft: `${level * 16 + 10}px`,
            }}
          >
            <item.icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        )}
      </div>
    );
  };

  return (
    <div className="layout">
      <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <rect width="12" height="12" rx="3" fill="#2563eb" />
              <rect x="16" width="12" height="12" rx="3" fill="#93c5fd" />
              <rect y="16" width="12" height="12" rx="3" fill="#93c5fd" />
              <rect x="16" y="16" width="12" height="12" rx="3" fill="#2563eb" />
            </svg>
          </div>
          {!collapsed && <span className="brand-name">Standphill</span>}
        </div>

        <button
          className="collapse-btn"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu size={16} /> : <X size={16} />}
        </button>

        <nav className="sidebar-nav">{NAV.map((item) => renderNavItem(item))}</nav>

        <button
          className="logout-btn"
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </aside>

      <main className="main-content">{children}</main>

      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background: #f0f4ff;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        .sidebar {
          width: 220px;
          min-height: 100vh;
          background: #fff;
          border-right: 1px solid #e5e7eb;
          display: flex;
          flex-direction: column;
          padding: 16px 12px;
          gap: 4px;
          position: sticky;
          top: 0;
          height: 100vh;
          transition: width 0.2s ease;
          flex-shrink: 0;
        }

        .sidebar.collapsed {
          width: 60px;
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 8px 16px;
          border-bottom: 1px solid #f3f4f6;
          margin-bottom: 8px;
          overflow: hidden;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          background: #eff6ff;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .brand-name {
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          white-space: nowrap;
        }

        .collapse-btn {
          align-self: flex-end;
          width: 28px;
          height: 28px;
          background: #f3f4f6;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          margin-bottom: 8px;
          transition: background 0.15s;
        }

        .collapse-btn:hover {
          background: #e5e7eb;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          text-decoration: none;
          transition: all 0.15s;
          overflow: hidden;
          white-space: nowrap;
          background: none;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }

        .nav-item:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .nav-item.active {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 600;
        }

        .nav-item.dropdown-toggle {
          position: relative;
        }

        .chevron-icon {
          transition: transform 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chevron-icon.expanded {
          transform: rotate(180deg);
        }

        .dropdown-children {
          display: flex;
          flex-direction: column;
          gap: 2px;
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }

        .nav-item.child-item {
          padding-left: 26px;
          font-size: 13px;
          color: #9ca3af;
        }

        .nav-item.child-item:hover {
          background: #f9fafb;
          color: #6b7280;
        }

        .nav-item.child-item.active {
          background: #f0f9ff;
          color: #0284c7;
          border-left: 3px solid #0284c7;
          padding-left: 23px;
        }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 10px;
          border-radius: 9px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          width: 100%;
          transition: all 0.15s;
          overflow: hidden;
          white-space: nowrap;
          margin-top: auto;
        }

        .logout-btn:hover {
          background: #fef2f2;
          color: #dc2626;
        }

        .main-content {
          flex: 1;
          overflow-y: auto;
          min-height: 100vh;
        }
      `}</style>
    </div>
  );
}