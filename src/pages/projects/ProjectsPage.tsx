import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchProjects,
  type ProjectResponse,
  type ProjectStage,
} from "../../services/projectService";
import CertificateModal from "../../components/CertificateModal";
import { useToast } from "../../context/ToastContext";
import type { CertificationResponse } from "../../services/certificationService";

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { addToast } = useToast();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const [certModal, setCertModal] = useState<{ project: ProjectResponse } | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetchProjects({ page: 0, size: 50 });
      setProjects(res.content);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-gray-500">BIS Certification Projects</p>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading Projects…</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                <th className="p-3 text-left">Project</th>
                <th className="p-3 text-left">Certification</th>
                <th className="p-3 text-left">Stage</th>
                <th className="p-3 text-left">Team</th>
                <th className="p-3 text-left">Engineer</th>
                <th className="p-3 text-left">Deadline</th>
                <th className="p-3 text-left">Timeline</th>
                <th className="p-3 text-left">Certificate</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{project.projectName}</td>
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
                  <td className="p-3">{project.teamName ?? "—"}</td>
                  <td className="p-3">{project.engineerEmail ?? "—"}</td>
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
                <tr><td colSpan={8} className="p-6 text-center text-gray-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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