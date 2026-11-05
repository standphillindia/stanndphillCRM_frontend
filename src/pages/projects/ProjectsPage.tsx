import { useEffect, useRef, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { Link } from "react-router-dom";
import {
  fetchProjects,
  moveProjectsToBatch,
  type ProjectBatch,
  type ProjectResponse,
  type ProjectStage,
} from "../../services/projectService";
import { useAuth } from "../../context/AuthContext";
import { getRoleFromToken } from "../../utils/jwt";
import { visitRoles } from "../../utils/visitPermissions";
import CertificateModal from "../../components/CertificateModal";
import { useToast } from "../../context/ToastContext";
import type { CertificationResponse } from "../../services/certificationService";
import AddProjectModal from "../../components/projects/AddProjectModal";
import AssignProjectsModal from "../../components/projects/AssignProjectsModal";
import EditProjectDetailsModal from "../../components/projects/EditProjectDetailsModal";
import ClampText from "../../components/common/ClampText";

// ── NOTE ──────────────────────────────────────────────────────────────────
// The old manual "Move Next" stage-transition flow (STAGE_FLOW, moveStage,
// Engineer Visit scheduling modal, Complete Visit modal) has been removed.
// Stage progression is now driven entirely by the day-wise Project Stage
// Tracker — see "View Timeline" below, which links to ProjectStagesPage.tsx.
//
// `project.stage` (the old ProjectStage enum) is still shown as a
// read-only badge — it's kept in the backend purely as a coarse summary
// bucket (dashboard counts, filters) and gets updated automatically by the
// tracker (e.g. set to CLOSED when the final stage completes), not by any
// button on this page anymore.
//
// Certificate creation is kept as an independent action (it creates a
// real Certification record) rather than being gated behind a specific
// stage transition.

const stageLabel = (s: ProjectStage) => s.replace(/_/g, " ");

const STAGE_COLORS: Partial<Record<ProjectStage, string>> = {
  DRAFT:              "bg-gray-100 text-gray-700",
  PROJECT_CREATED:    "bg-gray-100 text-gray-700",
  ENGINEER_VISIT:     "bg-orange-100 text-orange-700",
  DOCUMENT_UPLOAD:    "bg-yellow-100 text-yellow-700",
  LICENSE_GRANTED:    "bg-green-100 text-green-700",
  CLOSED:             "bg-blue-100 text-blue-700",
};
const stageBadge = (s: ProjectStage) => STAGE_COLORS[s] ?? "bg-purple-100 text-purple-700";

/** "2026-10-22" → "22-10-2026". */
const showDate = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "—";
};

/** ISO timestamp → its date in India (yyyy-MM-dd). */
const toIstDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { addToast } = useToast();
  const { token } = useAuth();
  const isAdmin = getRoleFromToken(token) === "ADMIN";
  // Admin and the Operations team can move projects between New and Old.
  // Move New/Old + edit client details: Admin, Ops, or "Project details" (Edit).
  const perms = usePermissions();
  const canMoveBatch = isAdmin || visitRoles(token).isOps || perms.can("PROJECT_DETAILS", "EDIT");
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  // New / Old tabs. Old = every project that was in the CRM before this
  // split went live (many of them running late); New = added since, on
  // a strict timeline. Admin can move projects between the two.
  const [batch, setBatch] = useState<ProjectBatch>("NEW");

  // Edit project name & client details (Admin / Operations).
  const [editFor, setEditFor] = useState<ProjectResponse | null>(null);
  const [moving, setMoving] = useState(false);

  // Sorted by the project's start date — newest first; click the column
  // header to flip it.
  const [dateSort, setDateSort] = useState<"desc" | "asc">("desc");
  const [loading, setLoading] = useState(false);

  // Paging + search. The page used to fetch only the newest 50 projects
  // with no way to see the rest — older projects simply disappeared.
  const PAGE_SIZE = 25;
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [search, setSearch] = useState("");

  const [certModal, setCertModal] = useState<{ project: ProjectResponse } | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  // Manual "Add Project" — shown to everyone who can open this page. Who
  // may actually save is decided by PROJECTS write access in the role
  // permission matrix (enforced by the backend).
  const [showAddProject, setShowAddProject] = useState(false);

  // Assign Ops person / engineer — one row ("Assign" in the row) or many
  // (tick the rows, then "Assign selected").
  // Picked rows, kept by id (selection stays when you change page).
  const [selected, setSelected] = useState<Record<string, ProjectResponse>>({});
  const [assignFor, setAssignFor] = useState<ProjectResponse[] | null>(null);
  const selectedCount = Object.keys(selected).length;

  const toggleSelected = (project: ProjectResponse) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[project.id]) delete next[project.id];
      else next[project.id] = project;
      return next;
    });
  const allOnPageSelected = projects.length > 0 && projects.every((p) => selected[p.id]);
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = { ...prev };
      if (allOnPageSelected) projects.forEach((p) => delete next[p.id]);
      else projects.forEach((p) => { next[p.id] = p; });
      return next;
    });

  const handleAssigned = async (count: number) => {
    setAssignFor(null);
    setSelected({});
    await loadProjects();
    addToast({
      title: "Assigned",
      message: count === 1 ? "Project assigned." : `${count} projects assigned.`,
      type: "success",
    });
  };

  const handleProjectAdded = async (project: ProjectResponse) => {
    setShowAddProject(false);
    await loadProjects();
    addToast({
      title: "Project added",
      message: `${project.projectName} is now at "${project.currentStageDisplayName ?? "its first stage"}".`,
      type: "success",
    });
  };

  const loadProjects = async (p: number = page, q: string = search, b: ProjectBatch = batch) => {
    try {
      setLoading(true);
      const res = await fetchProjects({
        page: p, size: PAGE_SIZE, search: q, batch: b, sortBy: "startDate", sortDir: dateSort,
      });
      setProjects(res.content);
      setTotalPages(res.totalPages);
      setTotalElements(res.totalElements);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects(page, search, batch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, batch, dateSort]);

  const flipDateSort = () => {
    setPage(0);
    setDateSort((d) => (d === "desc" ? "asc" : "desc"));
  };

  const switchBatch = (b: ProjectBatch) => {
    if (b === batch) return;
    setSelected({});
    setPage(0);
    setBatch(b);
  };

  const moveSelected = async () => {
    const ids = Object.keys(selected);
    if (ids.length === 0) return;
    const target: ProjectBatch = batch === "NEW" ? "OLD" : "NEW";
    if (!window.confirm(`Move ${ids.length} project(s) to ${target === "OLD" ? "Old" : "New"} projects?`)) return;
    setMoving(true);
    try {
      await moveProjectsToBatch(ids, target);
      setSelected({});
      await loadProjects();
      addToast({
        title: "Moved",
        message: `${ids.length} project(s) moved to ${target === "OLD" ? "Old" : "New"} projects.`,
        type: "success",
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({ title: "Error", message: msg ?? "Could not move the projects.", type: "error" });
    } finally {
      setMoving(false);
    }
  };

  // Typing in the search box goes back to page 1 after a short pause.
  const searchMounted = useRef(false);
  useEffect(() => {
    if (!searchMounted.current) { searchMounted.current = true; return; }
    const t = setTimeout(() => {
      if (page === 0) loadProjects(0, search);
      else setPage(0);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const confirmCertificateCreate = async (certificate: CertificationResponse) => {
    setCertLoading(true);
    try {
      setCertModal(null);
      await loadProjects();
      addToast({
        title: "Certificate Created",
        message: `Certificate ${certificate.certificateNo} created successfully`,
        type: "success",
      });
    } finally {
      setCertLoading(false);
    }
  };

  return (
    <div className="p-0 lg:p-6">
      <div className="mb-4 lg:mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-gray-500">BIS Certification Projects</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project or company…"
            className="w-full sm:w-64 max-w-full px-3 py-2 rounded-lg border text-sm"
          />
          {selectedCount > 0 && (
            <button
              onClick={() => setAssignFor(Object.values(selected))}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700"
            >
              Assign selected ({selectedCount})
            </button>
          )}
          {canMoveBatch && selectedCount > 0 && (
            <button
              onClick={moveSelected}
              disabled={moving}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {moving ? "Moving…" : `Move to ${batch === "NEW" ? "Old" : "New"} (${selectedCount})`}
            </button>
          )}
          <button
            onClick={() => setShowAddProject(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            + Add Project
          </button>
        </div>
      </div>

      {/* New / Old projects */}
      <div className="mb-4 flex flex-wrap items-end gap-1 border-b">
        {(["NEW", "OLD"] as ProjectBatch[]).map((b) => (
          <button
            key={b}
            onClick={() => switchBatch(b)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              batch === b ? "border-blue-700 text-blue-800" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {b === "NEW" ? "New projects" : "Old projects"}
            {batch === b && !loading && <span className="ml-1 text-xs text-gray-400">({totalElements})</span>}
          </button>
        ))}
        <span className="hidden sm:inline ml-auto pb-2 text-xs text-gray-500">
          {batch === "NEW"
            ? "Projects added from now on — keep these on time."
            : "Projects that were already running before the split."}
        </span>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading Projects…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          {/* Phone / tablet: one card per project. The table is for laptops. */}
          <div className="lg:hidden divide-y">
            {projects.length === 0 && <p className="p-6 text-center text-gray-400 text-sm">No projects found.</p>}
            {projects.map((project) => (
              <div
                key={project.id}
                className={`p-4 border-l-4 ${project.currentStageLate ? "border-red-600" : "border-blue-600"} ${
                  selected[project.id] ? "bg-blue-50/50" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${project.projectName}`}
                    checked={!!selected[project.id]}
                    onChange={() => toggleSelected(project)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/projects/${project.id}/stages`} className="font-bold text-[15px] leading-snug text-gray-900 break-words">
                        {project.projectName}
                      </Link>
                      {project.certificationType && (
                        <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          {project.certificationType}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
                      <span className="text-gray-500">Stage:</span>
                      {project.currentStageDisplayName ? (
                        <>
                          <b className="font-semibold">{project.currentStageDisplayName}</b>
                          {project.currentStageLate && project.currentStageDaysLateOrRemaining != null && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              {Math.abs(project.currentStageDaysLateOrRemaining)}d late
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageBadge(project.stage)}`}>
                          {stageLabel(project.stage)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>👷 {project.engineerName ?? project.engineerEmail ?? "No engineer"}</span>
                      <span>🧑‍💼 {project.opsPersonName ?? project.opsPersonEmail ?? "No ops person"}</span>
                      <span>📅 Deadline {project.deadline ?? "—"}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link
                        to={`/projects/${project.id}/stages`}
                        className="py-2.5 rounded-xl text-sm font-semibold text-center text-white bg-blue-600"
                      >
                        Stages &amp; notes
                      </Link>
                      <button
                        onClick={() => setAssignFor([project])}
                        className="py-2.5 rounded-xl text-sm font-semibold text-blue-700 border border-blue-200 bg-white"
                      >
                        {project.opsPersonEmail || project.engineerEmail ? "Change team" : "Assign"}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      {canMoveBatch && (
                        <button onClick={() => setEditFor(project)} className="font-medium text-blue-600">
                          Edit details
                        </button>
                      )}
                      {!(project.stage === "LICENSE_GRANTED" || project.stage === "CLOSED") && (
                        <button onClick={() => setCertModal({ project })} className="font-medium text-green-700">
                          Create Certificate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <table className="hidden lg:table w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                <th className="p-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                  />
                </th>
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Certification</th>
                <th className="p-3 text-left">Stage</th>
                <th className="p-3 text-left">Ops Person</th>
                <th className="p-3 text-left">Engineer</th>
                <th className="p-3 text-left">
                  <button
                    onClick={flipDateSort}
                    className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900"
                    title="Sort by start date"
                  >
                    Start date <span aria-hidden>{dateSort === "desc" ? "↓" : "↑"}</span>
                  </button>
                </th>
                <th className="p-3 text-left">Deadline</th>
                <th className="p-3 text-left">Timeline</th>
                <th className="p-3 text-left">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className={`border-b hover:bg-gray-50 ${selected[project.id] ? "bg-blue-50/50" : ""}`}>
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${project.projectName}`}
                      checked={!!selected[project.id]}
                      onChange={() => toggleSelected(project)}
                    />
                  </td>
                  <td className="p-3 font-medium min-w-[200px] max-w-[320px]">
                    <ClampText text={project.projectName} />
                    {canMoveBatch && (
                      <button
                        onClick={() => setEditFor(project)}
                        className="block mt-0.5 text-xs font-normal text-blue-600 hover:underline"
                      >
                        Edit details
                      </button>
                    )}
                  </td>
                  <td className="p-3">{project.certificationType}</td>
                  <td className="p-3">
                    {project.currentStageDisplayName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${
                          project.currentStageLate ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {project.currentStageDisplayName}
                        </span>
                        {project.currentStageLate && project.currentStageDaysLateOrRemaining != null && (
                          <span className="text-[10px] text-red-600 font-medium">
                            {Math.abs(project.currentStageDaysLateOrRemaining)}d late
                          </span>
                        )}
                      </div>
                    ) : (
                      // No tracker rows yet (created before the day-wise
                      // tracker existed, or the definitions weren't seeded
                      // at WON time) — fall back to the legacy stage badge
                      // so the row isn't blank.
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageBadge(project.stage)}`}>
                        {stageLabel(project.stage)}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {project.opsPersonName || project.opsPersonEmail ? (
                      <span title={project.opsPersonEmail ?? undefined}>
                        {project.opsPersonName ?? project.opsPersonEmail}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Not assigned</span>
                    )}
                    {project.teamName && (
                      <div className="text-[11px] text-gray-400">{project.teamName}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {project.engineerEmail ? (
                      <span title={project.engineerEmail}>{project.engineerName ?? project.engineerEmail}</span>
                    ) : (
                      "—"
                    )}
                    <div>
                      <button
                        onClick={() => setAssignFor([project])}
                        className="mt-1 text-xs font-medium text-blue-700 hover:underline"
                      >
                        {project.opsPersonEmail || project.engineerEmail ? "Change" : "Assign"}
                      </button>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {showDate(project.startDate)}
                    {/* Added to the CRM on a different day than it started
                        (imported old projects) — show both. */}
                    {project.createdAt && toIstDate(project.createdAt) !== project.startDate && (
                      <span className="block text-xs text-gray-500">Added {showDate(toIstDate(project.createdAt))}</span>
                    )}
                  </td>
                  <td className="p-3">{project.deadline ?? "—"}</td>
                  <td className="p-3">
                    <Link
                      to={`/projects/${project.id}/stages`}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                    >
                      View Timeline
                    </Link>
                  </td>
                  <td className="p-3">
                    {project.stage === "LICENSE_GRANTED" || project.stage === "CLOSED" ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        onClick={() => setCertModal({ project })}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700"
                      >
                        Create Certificate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {projects.length === 0 && (
                <tr><td colSpan={10} className="p-6 text-center text-gray-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
          {totalElements > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t text-sm text-gray-600">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalElements)} of {totalElements}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
                >
                  ← Prev
                </button>
                <span>Page {page + 1} of {Math.max(totalPages, 1)}</span>
                <button
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-gray-50"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddProject && (
        <AddProjectModal
          onClose={() => setShowAddProject(false)}
          onCreated={handleProjectAdded}
        />
      )}

      {editFor && (
        <EditProjectDetailsModal
          projectId={editFor.id}
          onClose={() => setEditFor(null)}
          onSaved={(d) => {
            setEditFor(null);
            setProjects((prev) => prev.map((p) => (p.id === d.id ? { ...p, projectName: d.projectName } : p)));
            addToast({ title: "Saved", message: `Project details updated — ${d.projectName}.`, type: "success" });
          }}
        />
      )}

      {assignFor && assignFor.length > 0 && (
        <AssignProjectsModal
          projects={assignFor}
          onClose={() => setAssignFor(null)}
          onAssigned={handleAssigned}
        />
      )}

      {certModal && (
        <CertificateModal
          project={certModal.project}
          onConfirm={confirmCertificateCreate}
          onClose={() => setCertModal(null)}
          loading={certLoading}
        />
      )}
    </div>
  );
}