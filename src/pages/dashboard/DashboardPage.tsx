// src/pages/dashboard/DashboardPage.tsx
//
// Home page, role-wise. Top of the page is always "today's work":
//   - everyone: their own stage tasks from My Tasks (late / due today /
//     next 3 days) — Admin sees the whole company's;
//   - Sales (and Admin): lead follow-ups due today or overdue;
//   - Admin: Team status — who is logged in right now and who is
//     holding late work.
// Business numbers (leads, projects, alerts) follow below for Admin, and
// for anyone else whose role has Dashboard access.
//
// Every block loads on its own, so a role without access to one of them
// (e.g. Operations has no Leads module) just doesn't see that block —
// the rest of the page still works.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import DtrBanner from "../../components/dtr/DtrBanner";
import { usePermissions } from "../../hooks/usePermissions";
import { decodeJwt } from "../../utils/jwt";
import { fetchMyTasks, isOldProjectStage, type StageTrackerResponse } from "../../services/projectStageService";
import { fetchFollowUpLeads, type LeadResponse } from "../../services/leadService";
import { fetchUsers, fetchUserDirectory, type UserResponse } from "../../services/userService";
import { fetchCompletedProjects } from "../../services/completedProjectsService";
import { getAllTasksAdmin, getMyTasks, type TaskResponse } from "../../services/taskService";

// ── Types ────────────────────────────────────────────────────────────────

// Project stages and manual tasks (Add Task / Urgent Tasks) share one
// shape so they sort and count together. `manual` marks the second kind.
type Task = StageTrackerResponse & {
  assignedUserEmail?: string | null;
  manual?: boolean;
};

/** Whole days from today (India) to a yyyy-MM-dd date; negative = past. */
const daysFromToday = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayIso().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
};

/** A manual task (Add Task / Urgent Tasks) in the same shape as a stage. */
const manualToTask = (t: TaskResponse): Task | null => {
  if (t.status === "DONE" || !t.dueDate) return null;
  const days = daysFromToday(t.dueDate);
  return {
    id: `task-${t.id}`,
    projectId: t.projectId,
    projectName: t.remarks?.trim() || "Manual task",
    stageCode: "MANUAL_TASK",
    displayName: t.taskName,
    groupOrder: 0,
    responsibleDepartment: "Task",
    validationType: "CHECKBOX",
    dueDate: t.dueDate,
    status: days < 0 ? "LATE" : "IN_PROGRESS",
    accessLocked: false,
    completedAt: null,
    completedByName: null,
    notes: null,
    daysLateOrRemaining: days,
    validationData: null,
    assignedUserEmail: t.assignedToEmail,
    manual: true,
  };
};

interface BusinessNumbers {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  wonLeads: number;
  activeProjects: number;
  completedProjects: number;
  completedThisMonth: number | null;
  pendingTasks: number;
  overdueTasks: number;
  overduePayments: number;
  renewalDueCertifications: number;
  followUpsDue: number;
  unreadNotifications: number;
}

type TaskFilter = "late" | "today" | "soon";

// ── Helpers ──────────────────────────────────────────────────────────────

/** Greeting by the hour in India, whatever the laptop's own time zone. */
const greetingFor = (date: Date) => {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(date)
  );
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
};

const todayLabel = () =>
  new Intl.DateTimeFormat("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata",
  }).format(new Date());

/** yyyy-MM-dd for today in India. */
const todayIso = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const taskBucket = (t: Task): TaskFilter | null => {
  if (t.status === "LATE") return "late";
  const d = t.daysLateOrRemaining;
  if (d === null || d === undefined) return null;
  if (d < 0) return "late";
  if (d === 0) return "today";
  if (d <= 3) return "soon";
  return null;
};

const nameFromEmail = (email?: string | null) =>
  email ? email.split("@")[0].replace(/[._]/g, " ") : "";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const timeAgo = (iso?: string | null) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", SALES: "Sales", FINANCE: "Finance", OPERATIONS: "Operations", ENGINEER: "Engineer",
};

// ── Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const jwt = decodeJwt(token);
  const role = (jwt?.role as string | undefined) ?? "";
  const myEmail = (jwt?.sub as string | undefined) ?? "";
  const department = (jwt?.department as string | undefined) ?? "";
  const isAdminRole = role === "ADMIN";
  // Team view (everyone's stages, tasks, follow-ups, team status): Admin,
  // or a role given "Team overview" in Users → Roles & Permissions.
  const perms = usePermissions();
  const isAdmin = isAdminRole || perms.can("TEAM_OVERVIEW");
  const permsReady = isAdminRole || perms.ready;
  const isSales = role === "SALES";
  // Real names (open name list) — for the greeting and for showing who a
  // late stage is with. Falls back to the email's first part.
  const [directory, setDirectory] = useState<Map<string, string>>(new Map());
  const nameOf = (email?: string | null) =>
    (email && directory.get(email.toLowerCase())) || nameFromEmail(email);
  const userName =
    directory.get(myEmail.toLowerCase())?.split(" ")[0] ||
    localStorage.getItem("userName") ||
    nameFromEmail(myEmail) ||
    "there";

  const [greeting, setGreeting] = useState(() => greetingFor(new Date()));
  useEffect(() => {
    const id = setInterval(() => setGreeting(greetingFor(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [followUps, setFollowUps] = useState<LeadResponse[] | null>(null);
  const [team, setTeam] = useState<UserResponse[] | null>(null);
  const [numbers, setNumbers] = useState<BusinessNumbers | null>(null);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("late");
  // New / Old projects — old projects' stages are counted and listed apart.
  const [projectView, setProjectView] = useState<"NEW" | "OLD">("NEW");

  useEffect(() => {
    let cancelled = false;
    if (!permsReady) return; // wait for the role's ticks — avoids loading twice
    const wantsFollowUps = isAdmin || isSales;

    (async () => {
      fetchUserDirectory()
        .then((list) => {
          if (!cancelled) setDirectory(new Map(list.map((u) => [u.email.toLowerCase(), u.fullName])));
        })
        .catch(() => undefined);

      const [taskRes, fuRes, teamRes, salesRes, projRes, alertRes, doneRes, manualRes] = await Promise.allSettled([
        fetchMyTasks(),
        wantsFollowUps ? fetchFollowUpLeads() : Promise.reject(new Error("skip")),
        isAdmin ? fetchUsers({}) : Promise.reject(new Error("skip")),
        api.get("/dashboard/sales"),
        api.get("/dashboard/projects"),
        api.get("/dashboard/alerts"),
        isAdmin ? fetchCompletedProjects() : Promise.reject(new Error("skip")),
        // Manual tasks: Admin sees everyone's, others their own.
        isAdmin ? getAllTasksAdmin() : getMyTasks(),
      ]);
      if (cancelled) return;

      const manual =
        manualRes.status === "fulfilled"
          ? manualRes.value.map(manualToTask).filter((t): t is Task => t !== null)
          : [];
      if (taskRes.status === "fulfilled") setTasks([...(taskRes.value as Task[]), ...manual]);
      else if (manual.length > 0) setTasks(manual);
      if (fuRes.status === "fulfilled") setFollowUps(fuRes.value);
      if (teamRes.status === "fulfilled") setTeam(teamRes.value);

      if (salesRes.status === "fulfilled" && projRes.status === "fulfilled" && alertRes.status === "fulfilled") {
        const s = salesRes.value.data, p = projRes.value.data, a = alertRes.value.data;
        setNumbers({
          totalLeads: s.totalLeads,
          newLeads: s.newLeads,
          qualifiedLeads: s.qualifiedLeads,
          wonLeads: s.convertedLeads,
          activeProjects: p.activeProjects,
          completedProjects: p.completedProjects,
          completedThisMonth: doneRes.status === "fulfilled" ? doneRes.value.thisMonth : null,
          pendingTasks: p.pendingTasks,
          overdueTasks: a.overdueTasks,
          overduePayments: a.overduePayments,
          renewalDueCertifications: a.renewalDueCertifications,
          followUpsDue: a.followUpsDue,
          unreadNotifications: a.unreadNotifications,
        });
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [isAdmin, isSales, permsReady]);

  // ── Derived: today's work ─────────────────────────────────────────────
  // Stages of the chosen New / Old projects (manual tasks count as New).
  const viewTasks = useMemo(
    () => (tasks ?? []).filter((t) => (projectView === "OLD") === isOldProjectStage(t)),
    [tasks, projectView]
  );

  const buckets = useMemo(() => {
    const b: Record<TaskFilter, Task[]> = { late: [], today: [], soon: [] };
    viewTasks.forEach((t) => {
      const k = taskBucket(t);
      if (k) b[k].push(t);
    });
    b.late.sort((x, y) => (x.daysLateOrRemaining ?? 0) - (y.daysLateOrRemaining ?? 0));
    b.soon.sort((x, y) => (x.daysLateOrRemaining ?? 0) - (y.daysLateOrRemaining ?? 0));
    return b;
  }, [viewTasks]);

  const followUpSplit = useMemo(() => {
    const t = todayIso();
    const due = (followUps ?? []).filter((l) => l.nextFollowUpDate && l.nextFollowUpDate <= t);
    return {
      overdue: due.filter((l) => l.nextFollowUpDate! < t),
      today: due.filter((l) => l.nextFollowUpDate === t),
      list: due.sort((a, b) => (a.nextFollowUpDate ?? "").localeCompare(b.nextFollowUpDate ?? "")),
    };
  }, [followUps]);

  // ── Derived: team status (Admin) ──────────────────────────────────────
  const teamRows = useMemo(() => {
    if (!team) return [];
    const late = new Map<string, number>();
    const today = new Map<string, number>();
    viewTasks.forEach((t) => {
      const who = t.assignedUserEmail?.toLowerCase();
      if (!who) return;
      const k = taskBucket(t);
      if (k === "late") late.set(who, (late.get(who) ?? 0) + 1);
      if (k === "today") today.set(who, (today.get(who) ?? 0) + 1);
    });
    return team
      .filter((u) => u.status !== "INVITED")
      .map((u) => ({
        user: u,
        online: u.status === "ACTIVE",
        late: late.get(u.email.toLowerCase()) ?? 0,
        today: today.get(u.email.toLowerCase()) ?? 0,
      }))
      .sort((a, b) =>
        Number(b.online) - Number(a.online) || b.late - a.late || a.user.fullName.localeCompare(b.user.fullName)
      );
  }, [team, viewTasks]);

  const unassignedLate = useMemo(() => {
    const byDept = new Map<string, number>();
    viewTasks.forEach((t) => {
      if (t.assignedUserEmail || taskBucket(t) !== "late") return;
      byDept.set(t.responsibleDepartment, (byDept.get(t.responsibleDepartment) ?? 0) + 1);
    });
    return Array.from(byDept.entries()).sort((a, b) => b[1] - a[1]);
  }, [viewTasks]);

  const onlineCount = teamRows.filter((r) => r.online).length;
  const shownTasks = buckets[taskFilter];

  // ── Quick actions per role ────────────────────────────────────────────
  const actions: { label: string; to: string; primary?: boolean }[] = isAdminRole
    ? [
        { label: "Create Lead", to: "/leads", primary: true },
        { label: "Projects", to: "/projects" },
        { label: "Payments", to: "/payments" },
        { label: "Add Task", to: "/tasks" },
      ]
    : isSales
    ? [
        { label: "Create Lead", to: "/leads", primary: true },
        { label: "My Leads", to: "/leads" },
        { label: "Add Task", to: "/tasks" },
      ]
    : role === "FINANCE"
    ? [
        { label: "My Tasks", to: "/my-tasks", primary: true },
        { label: "Payments", to: "/payments" },
        { label: "Add Task", to: "/tasks" },
      ]
    : [
        { label: "My Tasks", to: "/my-tasks", primary: true },
        { label: "Projects", to: "/projects" },
        { label: "Add Task", to: "/tasks" },
      ];

  return (
    <div className="max-w-[1400px] mx-auto px-1 sm:px-2 pb-10 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-sm text-gray-500">{todayLabel()}</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {greeting}, <span className="capitalize">{userName}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {ROLE_LABEL[role] ?? role}
            {department && department.toLowerCase() !== (ROLE_LABEL[role] ?? "").toLowerCase() ? ` · ${department}` : ""}
            {" · "}
            {isAdmin ? "Here is what the team has on today." : "Here is your work for today."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className={
                a.primary
                  ? "px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm"
                  : "px-4 py-2 rounded-lg text-sm font-semibold text-gray-800 bg-white border border-gray-300 hover:bg-gray-50"
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      </header>

      {/* Daily Task Report — fill / submit today's, or Team DTR for Admin */}
      {/* HR etc. fill their own DTR too, so only Admin gets the team count here. */}
      <DtrBanner isAdmin={isAdminRole} />

      {loading ? (
        <div className="py-20 text-center text-gray-500 text-sm">Loading your day…</div>
      ) : (
        <>
          {/* New / Old projects — the counters and list below follow this. */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Showing stages of</span>
            {(["NEW", "OLD"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setProjectView(v)}
                className={`px-3 py-1 rounded-full border text-sm font-medium ${
                  projectView === v ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {v === "NEW" ? "New projects" : "Old projects"}
              </button>
            ))}
          </div>

          {/* ── Today's work: counters ─────────────────────────────────── */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CounterTile
              label={isAdmin ? "Late stages (team)" : "Late"}
              value={buckets.late.length}
              tone="red"
              active={taskFilter === "late"}
              onClick={() => setTaskFilter("late")}
              hint="Past due date"
            />
            <CounterTile
              label="Due today"
              value={buckets.today.length}
              tone="amber"
              active={taskFilter === "today"}
              onClick={() => setTaskFilter("today")}
              hint="Finish before you leave"
            />
            <CounterTile
              label="Next 3 days"
              value={buckets.soon.length}
              tone="blue"
              active={taskFilter === "soon"}
              onClick={() => setTaskFilter("soon")}
              hint="Coming up"
            />
            {followUps ? (
              <CounterTile
                label="Follow-ups due"
                value={followUpSplit.list.length}
                tone="violet"
                onClick={() => navigate("/leads")}
                hint={`${followUpSplit.overdue.length} overdue · ${followUpSplit.today.length} today`}
              />
            ) : (
              <CounterTile
                label="All open work"
                value={tasks?.length ?? 0}
                tone="gray"
                onClick={() => navigate("/my-tasks")}
                hint="Stages + tasks"
              />
            )}
          </section>

          {/* ── Today's work: lists ────────────────────────────────────── */}
          <section className={`grid gap-4 ${isAdmin || followUps ? "lg:grid-cols-5" : ""}`}>
            {/* Stage tasks */}
            <Panel
              className={isAdmin || followUps ? "lg:col-span-3" : ""}
              title={
                taskFilter === "late" ? "Late — do these first"
                : taskFilter === "today" ? "Due today"
                : "Due in the next 3 days"
              }
              action={<Link to="/my-tasks" className="text-sm font-medium text-blue-700 hover:underline">Open My Tasks →</Link>}
            >
              {tasks === null ? (
                <Empty text="Could not load tasks." />
              ) : shownTasks.length === 0 ? (
                <Empty text={taskFilter === "late" ? "Nothing late. 🎉" : "Nothing here."} />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {shownTasks.slice(0, 8).map((t) => (
                    <li key={t.id}>
                      <Link
                        to={t.manual ? "/tasks" : `/projects/${t.projectId}/stages`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                      >
                        <DueChip task={t} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.displayName}</p>
                          <p className="text-xs text-gray-500 truncate">{t.projectName}</p>
                        </div>
                        <div className="hidden sm:block text-right shrink-0">
                          <p className="text-xs text-gray-500">{t.manual ? "Task" : t.responsibleDepartment}</p>
                          {isAdmin && (
                            <p className="text-xs font-medium text-gray-700 capitalize">
                              {t.assignedUserEmail ? nameOf(t.assignedUserEmail) : "Unassigned"}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {shownTasks.length > 8 && (
                <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                  +{shownTasks.length - 8} more in My Tasks
                </p>
              )}
            </Panel>

            {/* Right column: Team status (Admin) or Follow-ups (Sales) */}
            {isAdmin && (
              <Panel
                className="lg:col-span-2"
                title="Team status"
                subtitle={team ? `${onlineCount} of ${teamRows.length} logged in now` : undefined}
                action={<Link to="/users" className="text-sm font-medium text-blue-700 hover:underline">Users →</Link>}
              >
                {team === null ? (
                  <Empty text="Could not load the team." />
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
                    {teamRows.map(({ user, online, late, today }) => (
                      <li key={user.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="relative shrink-0">
                          <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">
                            {initials(user.fullName)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                              online ? "bg-emerald-500" : "bg-gray-300"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{user.fullName}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {ROLE_LABEL[user.role] ?? user.role} ·{" "}
                            {online ? <span className="text-emerald-700">Active now</span> : `seen ${timeAgo(user.lastSeenAt)}`}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {late > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700" title="Late stages">
                              {late} late
                            </span>
                          )}
                          {today > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700" title="Due today">
                              {today} today
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                    {unassignedLate.map(([dept, n]) => (
                      <li key={`un-${dept}`} className="flex items-center gap-3 px-4 py-2.5 bg-red-50/40">
                        <div className="w-8 h-8 rounded-full bg-white border border-dashed border-red-300 text-red-500 text-xs font-bold flex items-center justify-center shrink-0">
                          ?
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900">No one assigned</p>
                          <p className="text-xs text-gray-500">{dept} stages</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">{n} late</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            )}

            {!isAdmin && followUps && (
              <FollowUpPanelBox
                className="lg:col-span-2"
                leads={followUpSplit.list}
                today={todayIso()}
              />
            )}
          </section>

          {/* Admin also gets the follow-up list, under the team block. */}
          {isAdmin && followUps && followUpSplit.list.length > 0 && (
            <FollowUpPanelBox leads={followUpSplit.list} today={todayIso()} />
          )}

          {/* ── Business numbers ───────────────────────────────────────── */}
          {numbers && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Business</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <NumberTile label="Total leads" value={numbers.totalLeads} to="/leads" />
                <NumberTile label="New leads" value={numbers.newLeads} to="/leads" />
                <NumberTile label="Qualified" value={numbers.qualifiedLeads} to="/leads" />
                <NumberTile label="Won" value={numbers.wonLeads} to="/leads" />
                <NumberTile label="Projects running" value={numbers.activeProjects} to="/projects" />
                <NumberTile
                  label="Completed projects"
                  value={numbers.completedProjects}
                  sub={numbers.completedThisMonth !== null ? `${numbers.completedThisMonth} this month` : undefined}
                  to="/completed-projects"
                />
                <NumberTile label="Open stages" value={numbers.pendingTasks} sub={`${numbers.overdueTasks} late`} to="/my-tasks" />
                <NumberTile label="Unread notifications" value={numbers.unreadNotifications} to="/notifications" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <AlertTile label="Overdue payments" value={numbers.overduePayments} to="/payments/list" tone="red" />
                <AlertTile label="Certificates due (30 days)" value={numbers.renewalDueCertifications} to="/certifications" tone="amber" />
                <AlertTile label="Follow-ups due (all)" value={numbers.followUpsDue} to="/leads" tone="amber" />
              </div>
            </section>
          )}

          {/* ── Quick navigation ───────────────────────────────────────── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(isAdmin
              ? [
                  { label: "Tasks", to: "/tasks" },
                  { label: "Leads", to: "/leads" },
                  { label: "Projects", to: "/projects" },
                  { label: "Payments", to: "/payments" },
                ]
              : isSales
              ? [
                  { label: "Tasks", to: "/tasks" },
                  { label: "Leads", to: "/leads" },
                  { label: "Quotations", to: "/quotations" },
                  { label: "Reports", to: "/reports" },
                ]
              : role === "FINANCE"
              ? [
                  { label: "Tasks", to: "/tasks" },
                  { label: "My Tasks", to: "/my-tasks" },
                  { label: "Payments", to: "/payments" },
                  { label: "Projects", to: "/projects" },
                ]
              : [
                  { label: "Tasks", to: "/tasks" },
                  { label: "My Tasks", to: "/my-tasks" },
                  { label: "Projects", to: "/projects" },
                  { label: "Completed Projects", to: "/completed-projects" },
                ]
            ).map((q) => (
              <Link
                key={q.label}
                to={q.to}
                className="rounded-xl border border-gray-200 bg-white px-4 py-4 text-center text-sm font-semibold text-gray-800 hover:border-blue-300 hover:bg-blue-50/40"
              >
                {q.label}
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────

const TONES = {
  red:    { ring: "ring-red-500",    num: "text-red-700",    bg: "bg-red-50",    dot: "bg-red-500" },
  amber:  { ring: "ring-amber-500",  num: "text-amber-700",  bg: "bg-amber-50",  dot: "bg-amber-500" },
  blue:   { ring: "ring-blue-500",   num: "text-blue-700",   bg: "bg-blue-50",   dot: "bg-blue-500" },
  violet: { ring: "ring-violet-500", num: "text-violet-700", bg: "bg-violet-50", dot: "bg-violet-500" },
  gray:   { ring: "ring-gray-400",   num: "text-gray-800",   bg: "bg-gray-50",   dot: "bg-gray-400" },
} as const;

function CounterTile({
  label, value, tone, hint, active, onClick,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONES;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-sm ${
        active ? `ring-2 ${t.ring} border-transparent` : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${t.dot}`} />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 text-3xl font-bold ${value > 0 ? t.num : "text-gray-400"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </button>
  );
}

function Panel({
  title, subtitle, action, children, className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-gray-500">{text}</p>;
}

function DueChip({ task }: { task: Task }) {
  const d = task.daysLateOrRemaining;
  if (task.status === "LATE" || (d !== null && d < 0)) {
    return (
      <span className="shrink-0 w-16 text-center px-2 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-700">
        {d !== null ? `${Math.abs(d)}d late` : "Late"}
      </span>
    );
  }
  if (d === 0) {
    return <span className="shrink-0 w-16 text-center px-2 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700">Today</span>;
  }
  return (
    <span className="shrink-0 w-16 text-center px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700">
      {d !== null ? `${d}d left` : "—"}
    </span>
  );
}

function FollowUpPanelBox({
  leads, today, className = "",
}: {
  leads: LeadResponse[];
  today: string;
  className?: string;
}) {
  return (
    <Panel
      className={className}
      title="Follow-ups due"
      subtitle="Calls to make today and the ones already missed"
      action={<Link to="/leads" className="text-sm font-medium text-blue-700 hover:underline">Leads →</Link>}
    >
      {leads.length === 0 ? (
        <Empty text="No follow-ups due. 👍" />
      ) : (
        <ul className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {leads.slice(0, 12).map((l) => {
            const overdue = (l.nextFollowUpDate ?? "") < today;
            const name = [l.companyName, l.contactName].filter((x) => x && x !== "Website Lead").join(" · ") || l.phone || "Lead";
            return (
              <li key={l.id}>
                <Link to={`/leads?leadId=${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                  <span
                    className={`shrink-0 w-16 text-center px-2 py-1 rounded-md text-[11px] font-bold ${
                      overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {overdue
                      ? new Date(l.nextFollowUpDate!).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                      : "Today"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {l.status?.replace(/_/g, " ")}
                      {l.phone ? ` · ${l.phone}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {leads.length > 12 && (
        <p className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">+{leads.length - 12} more on the Leads page</p>
      )}
    </Panel>
  );
}

function NumberTile({ label, value, sub, to }: { label: string; value: number; sub?: string; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </Link>
  );
}

function AlertTile({ label, value, to, tone }: { label: string; value: number; to: string; tone: "red" | "amber" }) {
  const t = TONES[tone];
  return (
    <Link to={to} className={`flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 ${value > 0 ? t.bg : "bg-white"}`}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <span className={`text-xl font-bold ${value > 0 ? t.num : "text-gray-400"}`}>{value}</span>
    </Link>
  );
}