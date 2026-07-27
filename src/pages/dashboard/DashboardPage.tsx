// src/pages/dashboard/DashboardPage.tsx
// ✅ ICONS REMOVED
// ✅ Everything else unchanged - Same layout, same data, same functionality

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  followUpLeads: number;
  totalDeals: number;
  activeProjects: number;
  completedProjects: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  overduePayments: number;
  renewalDueCertifications: number;
  followUpsDue: number;
  unreadNotifications: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    wonLeads: 0,
    followUpLeads: 0,
    totalDeals: 0,
    activeProjects: 0,
    completedProjects: 0,
    pendingTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    overduePayments: 0,
    renewalDueCertifications: 0,
    followUpsDue: 0,
    unreadNotifications: 0,
  });

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const userName = localStorage.getItem("userName") || "Admin";

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const [salesRes, projectRes, alertsRes] = await Promise.all([
        api.get("/dashboard/sales"),
        api.get("/dashboard/projects"),
        api.get("/dashboard/alerts"),
      ]);

      setStats({
        totalLeads: salesRes.data.totalLeads,
        newLeads: salesRes.data.newLeads,
        qualifiedLeads: salesRes.data.qualifiedLeads,
        wonLeads: salesRes.data.convertedLeads,
        followUpLeads: salesRes.data.followUpLeadsCount,
        totalDeals: projectRes.data.activeProjects,
        activeProjects: projectRes.data.activeProjects,
        completedProjects: projectRes.data.completedProjects,
        pendingTasks: projectRes.data.pendingTasks,
        completedTasks: projectRes.data.completedTasks,
        overdueTasks: alertsRes.data.overdueTasks,
        overduePayments: alertsRes.data.overduePayments,
        renewalDueCertifications: alertsRes.data.renewalDueCertifications,
        followUpsDue: alertsRes.data.followUpsDue,
        unreadNotifications: alertsRes.data.unreadNotifications,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{cssVariables}</style>

      {/* Header Section */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.displayTitle}>Dashboard</h1>
            <p style={styles.welcomeText}>Welcome back, {userName}</p>
            <p style={styles.subText}>
              Here's what's happening with your accounts today.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {loading ? (
          <div style={styles.loadingState}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {/* Action Buttons */}
            <div style={styles.actionBar}>
              <button
                onClick={() => navigate("/leads")}
                style={{ ...styles.primaryButton }}
              >
                Create Lead
              </button>
              <button
                onClick={() => navigate("/payments")}
                style={{ ...styles.secondaryButton }}
              >
                Payments
              </button>
              <button
                onClick={() => navigate("/tasks")}
                style={{ ...styles.secondaryButton }}
              >
                Add Task
              </button>
            </div>

            {/* Alerts Section - Critical Metrics */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Critical Alerts</h2>
              <div style={styles.alertGrid}>
                <AlertCard
                  label="Overdue Tasks"
                  value={stats.overdueTasks}
                  severity="critical"
                  onClick={() => navigate("/my-tasks")}
                />
                <AlertCard
                  label="Overdue Payments"
                  value={stats.overduePayments}
                  severity="critical"
                  onClick={() => navigate("/payments/list")}
                />
                <AlertCard
                  label="Certs Due (30 days)"
                  value={stats.renewalDueCertifications}
                  severity="warning"
                  onClick={() => navigate("/certifications")}
                />
                <AlertCard
                  label="Follow-ups Due"
                  value={stats.followUpsDue}
                  severity="warning"
                  onClick={() => navigate("/leads")}
                />
                <AlertCard
                  label="Unread Notifications"
                  value={stats.unreadNotifications}
                  severity="info"
                  onClick={() => navigate("/notifications")}
                />
              </div>
            </section>

            {/* Sales Pipeline Section */}
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Sales Pipeline</h2>
                  <p style={styles.sectionDescription}>
                    Live lead pipeline from your CRM backend
                  </p>
                </div>
              </div>
              <div style={styles.statsGrid4}>
                <StatCard
                  label="Total Leads"
                  value={stats.totalLeads}
                  trend="up"
                  trendValue="12%"
                  color="#004ccd"
                />
                <StatCard
                  label="New Leads"
                  value={stats.newLeads}
                  trend="up"
                  trendValue="8%"
                  color="#0f62fe"
                />
                <StatCard
                  label="Qualified"
                  value={stats.qualifiedLeads}
                  trend="up"
                  trendValue="5%"
                  color="#24a148"
                />
                <StatCard
                  label="Won Leads"
                  value={stats.wonLeads}
                  trend="up"
                  trendValue="15%"
                  color="#f1c21b"
                />
              </div>
            </section>

            {/* Projects & Deals Overview */}
            <div style={styles.twoColumnGrid}>
              {/* Projects Section */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Projects</h2>
                <div style={styles.statsGrid2x2}>
                  <StatCard
                    label="Active Projects"
                    value={stats.activeProjects}
                    color="#004ccd"
                  />
                  <StatCard
                    label="Completed"
                    value={stats.completedProjects}
                    color="#24a148"
                  />
                  <StatCard
                    label="Pending Tasks"
                    value={stats.pendingTasks}
                    color="#f1c21b"
                  />
                  <StatCard
                    label="Completed Tasks"
                    value={stats.completedTasks}
                    color="#24a148"
                  />
                </div>
              </section>

              {/* Deals Section */}
              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Deals</h2>
                <div
                  onClick={() => navigate("/deals")}
                  style={styles.dealsCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(0, 44, 112, 0.12)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 4px 8px rgba(0, 0, 0, 0.04)";
                  }}
                >
                  <div style={styles.dealsCardLabel}>TOTAL DEALS</div>
                  <div style={styles.dealsCardValue}>{stats.totalDeals}</div>
                  <div style={styles.dealsCardLink}>View details →</div>
                </div>
              </section>
            </div>

            {/* Quick Navigation */}
            <section style={styles.section}>
              <h2 style={styles.sectionTitle}>Quick Navigation</h2>
              <div style={styles.quickNavGrid}>
                <QuickLink
                  label="Tasks"
                  onClick={() => navigate("/tasks")}
                />
                <QuickLink
                  label="Leads"
                  onClick={() => navigate("/leads")}
                />
                <QuickLink
                  label="Deals"
                  onClick={() => navigate("/deals")}
                />
                <QuickLink
                  label="Projects"
                  onClick={() => navigate("/projects")}
                />
                <QuickLink
                  label="Payments"
                  onClick={() => navigate("/payments")}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

// ── ALERT CARD COMPONENT ──────────────────────────────────────────

function AlertCard({
  label,
  value,
  severity,
  onClick,
}: {
  label: string;
  value: number;
  severity: "critical" | "warning" | "info";
  onClick?: () => void;
}) {
  const severityStyles = {
    critical: {
      bg: "rgba(186, 26, 26, 0.08)",
      border: "rgba(186, 26, 26, 0.2)",
      text: "#ba1a1a",
      number: "#ba1a1a",
    },
    warning: {
      bg: "rgba(241, 194, 27, 0.08)",
      border: "rgba(241, 194, 27, 0.2)",
      text: "#b87f0b",
      number: "#b87f0b",
    },
    info: {
      bg: "rgba(0, 76, 205, 0.08)",
      border: "rgba(0, 76, 205, 0.2)",
      text: "#004ccd",
      number: "#004ccd",
    },
  };

  const severity_style = severityStyles[severity];

  return (
    <div
      onClick={onClick}
      style={{
        background: severity_style.bg,
        border: `1px solid ${severity_style.border}`,
        borderRadius: "8px",
        padding: "20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s cubic-bezier(0.2, 0, 0.38, 0.9)",
        backdropFilter: "blur(8px)",
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.borderColor = severity_style.text;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = severity_style.border;
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#737687",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "12px",
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: severity_style.number,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── STAT CARD COMPONENT ────────────────────────────────────────────

function StatCard({
  label,
  value,
  trend,
  trendValue,
  color,
}: {
  label: string;
  value: number;
  trend?: "up" | "down";
  trendValue?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        borderRadius: "8px",
        padding: "20px",
        transition: "all 0.3s cubic-bezier(0.2, 0, 0.38, 0.9)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 12px 24px rgba(0, 0, 0, 0.08), inset 1px 1px 0 rgba(255, 255, 255, 0.8)";
        e.currentTarget.style.borderColor = color + "30";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.04)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
          justifyContent: "space-between",
        }}
      >
        <div></div>
        {trend && trendValue && (
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: trend === "up" ? "#24a148" : "#ba1a1a",
              background: trend === "up" ? "#e6f2e6" : "#ffe6e6",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
          >
            {trend === "up" ? "↑" : "↓"} {trendValue}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#737687",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── QUICK LINK COMPONENT ───────────────────────────────────────────

function QuickLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        borderRadius: "8px",
        padding: "24px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.2, 0, 0.38, 0.9)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow =
          "0 12px 24px rgba(0, 76, 205, 0.12), inset 1px 1px 0 rgba(255, 255, 255, 0.8)";
        e.currentTarget.style.borderColor = "#004ccd30";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.04)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.5)";
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#1c1b1b",
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// STYLES
// ────────────────────────────────────────────────────────────────────

const cssVariables = `
  :root {
    --primary: #004ccd;
    --primary-bright: #0f62fe;
    --primary-container: #dbe1ff;
    --secondary: #585f66;
    --tertiary: #304db9;
    --error: #ba1a1a;
    --success: #24a148;
    --warning: #f1c21b;
    --surface: #fcf9f8;
    --surface-container-low: #f6f3f2;
    --surface-container: #f0edec;
    --on-surface: #1c1b1b;
    --on-surface-variant: #424656;
    --outline: #737687;
    --outline-variant: #c3c6d8;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const styles = {
  container: {
    background: "linear-gradient(135deg, #fcf9f8 0%, #f6f3f2 100%)",
    minHeight: "100vh",
    paddingBottom: "40px",
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  header: {
    background: "rgba(255, 255, 255, 0.8)",
    backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.5)",
    padding: "32px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },

  headerContent: {
    maxWidth: "1440px",
    margin: "0 auto",
  },

  displayTitle: {
    margin: "0 0 12px 0",
    fontSize: "36px",
    fontWeight: 700,
    color: "#1c1b1b",
    letterSpacing: "-0.02em",
  },

  welcomeText: {
    margin: "0 0 4px 0",
    fontSize: "16px",
    fontWeight: 400,
    color: "#1c1b1b",
  },

  subText: {
    margin: 0,
    fontSize: "14px",
    color: "#737687",
  },

  mainContent: {
    padding: "32px",
    maxWidth: "1440px",
    margin: "0 auto",
  },

  loadingState: {
    textAlign: "center" as const,
    padding: "60px 20px",
    color: "#737687",
  },

  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(0, 76, 205, 0.2)",
    borderTop: "3px solid #004ccd",
    borderRadius: "50%",
    margin: "0 auto 16px",
    animation: "spin 1s linear infinite",
  },

  loadingText: {
    fontSize: "14px",
    color: "#737687",
  },

  actionBar: {
    display: "flex" as const,
    gap: "12px",
    marginBottom: "32px",
  },

  primaryButton: {
    padding: "12px 24px",
    background: "#004ccd",
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    transition: "all 0.2s cubic-bezier(0.2, 0, 0.38, 0.9)",
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px",
    boxShadow: "0 4px 12px rgba(0, 76, 205, 0.3)",
  },

  secondaryButton: {
    padding: "12px 24px",
    background: "rgba(255, 255, 255, 0.7)",
    color: "#1c1b1b",
    border: "1px solid #c3c6d8",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "14px",
    transition: "all 0.2s cubic-bezier(0.2, 0, 0.38, 0.9)",
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px",
    backdropFilter: "blur(8px)",
  },

  section: {
    marginBottom: "32px",
  },

  sectionHeader: {
    display: "flex" as const,
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
  },

  sectionTitle: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    fontWeight: 600,
    color: "#1c1b1b",
  },

  sectionDescription: {
    margin: 0,
    fontSize: "13px",
    color: "#737687",
  },

  alertGrid: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px",
  },

  statsGrid4: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },

  statsGrid2x2: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
  },

  twoColumnGrid: {
    display: "grid" as const,
    gridTemplateColumns: "1fr 1fr",
    gap: "24px",
  },

  dealsCard: {
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.5)",
    borderRadius: "8px",
    padding: "32px",
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.2, 0, 0.38, 0.9)",
    display: "flex" as const,
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    minHeight: "240px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.04)",
  },

  dealsCardLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#737687",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "8px",
  },

  dealsCardValue: {
    fontSize: "36px",
    fontWeight: 700,
    color: "#004ccd",
    marginBottom: "16px",
  },

  dealsCardLink: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#004ccd",
    opacity: 0.8,
  },

  quickNavGrid: {
    display: "grid" as const,
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: "12px",
  },
};