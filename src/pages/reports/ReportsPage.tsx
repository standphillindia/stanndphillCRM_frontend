// src/pages/reports/ReportsPage.tsx
//
// All seven reports on one page of their own, reached from the sidebar.
//
// They used to sit at the bottom of the Dashboard, under the counters —
// which meant scrolling past the whole dashboard to reach them, and made
// the dashboard itself a long page nobody read to the end of. A report is
// something you go and look at on purpose, so it gets its own route.
//
// This is an ordinary in-app route (/reports), not a new browser tab: the
// sidebar's NavLink swaps the page in place, the way Leads and Projects
// do, so the sidebar stays put and nothing reloads.
//
// The page is only a shell. Each section owns its own data, date range
// and loading state, so one slow or failing report never blanks the
// other.

import PipelineReports from "../../components/dashboard/PipelineReports";
import TeamReports from "../../components/dashboard/TeamReports";

export default function ReportsPage() {
  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

  return (
    <div style={styles.container}>
      <div style={{ ...styles.header, padding: isMobile ? "20px 16px" : "32px" }}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Reports</h1>
          <p style={styles.subtitle}>
            Where the pipeline stalls, why deals are lost, who is closing
            what, and where the money comes from
          </p>
        </div>
      </div>

      <div style={{ ...styles.main, padding: isMobile ? "16px 4px" : "32px" }}>
        <div style={styles.inner}>
          <PipelineReports />
          <TeamReports />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
  },
  headerContent: { maxWidth: "1440px", margin: "0 auto" },

  title: {
    margin: "0 0 8px 0",
    fontSize: "32px",
    fontWeight: 700,
    color: "#1c1b1b",
    letterSpacing: "-0.02em",
  },
  subtitle: { margin: 0, fontSize: "14px", color: "#737687", maxWidth: "640px" },

  main: {},
  inner: { maxWidth: "1440px", margin: "0 auto" },
};