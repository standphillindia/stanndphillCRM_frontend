import { useEffect, useRef, useState } from "react";
import {
  fetchProjects,
  transitionProject,
  getProjectVisits,
  completeVisit,
  type ProjectResponse,
  type ProjectStage,
  type VisitResponse,
} from "../../services/projectService";
import { fetchUsers, type UserResponse as OrgUserResponse } from "../../services/userService";
import CertificateModal from "../../components/CertificateModal";
import { useToast } from "../../context/ToastContext";
import type { CertificationResponse } from "../../services/certificationService";

const STAGE_FLOW: ProjectStage[] = [
  "PROJECT_CREATED","DOCUMENT_COLLECTION","PORTAL_REGISTRATION",
  "PROFILE_CREATION","SAMPLE_PLANNING","SAMPLE_SENT_TO_CLIENT",
  "CLIENT_SAMPLE_READY","SAMPLE_SENT_TO_LAB","ENGINEER_VISIT",
  "DOCUMENT_UPLOAD","LAB_REPORT_RECEIVED","APPLICATION_REVIEW",
  "FEE_PAYMENT","APPLICATION_SUBMITTED","INSPECTION",
  "QUERY_HANDLING","LICENSE_GRANTED","CLOSED",
];

const getNextStage = (stage: ProjectStage): ProjectStage | null => {
  const idx = STAGE_FLOW.indexOf(stage);
  if (idx === -1 || idx === STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[idx + 1];
};

const stageLabel = (s: ProjectStage) => s.replace(/_/g, " ");

// ── Engineer Visit Scheduling Modal ──────────────────────────────────────────

interface EngineerVisitModalProps {
  project: ProjectResponse;
  onConfirm: (visitDate: string, engineerEmail?: string) => void;
  onClose: () => void;
  loading: boolean;
}

function EngineerVisitModal({ project, onConfirm, onClose, loading }: EngineerVisitModalProps) {
  const [visitDate, setVisitDate] = useState("");
  const [engineerEmail, setEngineerEmail] = useState(project.engineerEmail ?? "");

  // NEW — this used to be a free-text email input the user had to type
  // correctly by hand. Now it lists every real ENGINEER from the DB by
  // name, click to select.
  const [engineers, setEngineers] = useState<OrgUserResponse[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(true);

  useEffect(() => {
    fetchUsers({ role: "ENGINEER" })
      .then(setEngineers)
      .catch(() => setEngineers([]))
      .finally(() => setLoadingEngineers(false));
  }, []);

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">Schedule Engineer Visit</h2>
        <p className="text-gray-500 text-sm mb-5">
          Project: <span className="font-medium text-gray-700">{project.projectName}</span>
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Engineer</label>

          {loadingEngineers ? (
            <p className="text-sm text-gray-400">Loading engineers…</p>
          ) : engineers.length === 0 ? (
            <p className="text-sm text-gray-400">No engineers found — add one under Users first.</p>
          ) : (
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {engineers.map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setEngineerEmail(eng.email)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                    engineerEmail === eng.email ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-50"
                  }`}
                >
                  <span>{eng.fullName}</span>
                  <span className="text-xs text-gray-400">{eng.email}</span>
                </button>
              ))}
            </div>
          )}

          {project.engineerEmail && (
            <p className="text-xs text-gray-400 mt-1">Currently: {project.engineerEmail}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Visit Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            min={today}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!visitDate) { alert("Please select a visit date."); return; }
              onConfirm(visitDate, engineerEmail.trim() || undefined);
            }}
            disabled={loading || !visitDate}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm disabled:bg-gray-400 hover:bg-blue-700"
          >
            {loading ? "Scheduling…" : "Schedule & Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Complete Visit Modal (with local file upload) ─────────────────────────────

interface CompleteVisitModalProps {
  visit: VisitResponse;
  onConfirm: (imageBase64: string, remarks: string) => void;
  onClose: () => void;
  loading: boolean;
}

function CompleteVisitModal({ visit, onConfirm, onClose, loading }: CompleteVisitModalProps) {
  const [remarks, setRemarks] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: only images
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, etc.)");
      return;
    }

    // Validate: max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Max size is 5MB.");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result); // base64 data URL for preview
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">Complete Engineer Visit</h2>
        <p className="text-gray-500 text-sm mb-5">
          Visit Date:{" "}
          <span className="font-medium text-gray-700">{visit.visitDate}</span>
        </p>

        {/* File Upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Factory Photo <span className="text-red-500">*</span>
          </label>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview}
                  alt="preview"
                  className="mx-auto max-h-40 rounded-lg object-cover"
                />
                <p className="text-xs text-gray-500">{fileName}</p>
                <p className="text-xs text-blue-500">Click to change photo</p>
              </div>
            ) : (
              <div className="space-y-2 py-2">
                <div className="text-4xl">📷</div>
                <p className="text-sm font-medium text-gray-600">
                  Click to upload factory photo
                </p>
                <p className="text-xs text-gray-400">JPG, PNG up to 5MB</p>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </div>

        {/* Remarks */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Visit notes…"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!preview) { alert("Please upload a factory photo."); return; }
              onConfirm(preview, remarks);
            }}
            disabled={loading || !preview}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm disabled:bg-gray-400 hover:bg-green-700"
          >
            {loading ? "Completing…" : "Mark Complete & Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Stage badge colors ────────────────────────────────────────────────────────

const STAGE_COLORS: Partial<Record<ProjectStage, string>> = {
  PROJECT_CREATED:   "bg-gray-100 text-gray-700",
  ENGINEER_VISIT:    "bg-orange-100 text-orange-700",
  DOCUMENT_UPLOAD:   "bg-yellow-100 text-yellow-700",
  LICENSE_GRANTED:   "bg-green-100 text-green-700",
  CLOSED:            "bg-blue-100 text-blue-700",
};
const stageBadge = (s: ProjectStage) => STAGE_COLORS[s] ?? "bg-purple-100 text-purple-700";

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { addToast } = useToast();
  const [projects, setProjects]             = useState<ProjectResponse[]>([]);
  const [loading, setLoading]               = useState(false);
  const [visitModal, setVisitModal]         = useState<{ project: ProjectResponse } | null>(null);
  const [visitLoading, setVisitLoading]     = useState(false);
  const [completeModal, setCompleteModal]   = useState<{ project: ProjectResponse; visit: VisitResponse } | null>(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  
  // ✅ Certificate modal state
  const [certModal, setCertModal] = useState<{ project: ProjectResponse } | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const res = await fetchProjects({ page: 0, size: 50 });
      setProjects(res.content);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadProjects(); }, []);

  const moveStage = async (project: ProjectResponse, nextStage: ProjectStage) => {
    // ✅ LICENSE_GRANTED — open certificate modal
    if (nextStage === "LICENSE_GRANTED") {
      setCertModal({ project });
      return;
    }

    // ENGINEER_VISIT — open scheduling popup
    if (nextStage === "ENGINEER_VISIT") {
      setVisitModal({ project });
      return;
    }

    // DOCUMENT_UPLOAD from ENGINEER_VISIT — need to complete visit first
    if (nextStage === "DOCUMENT_UPLOAD" && project.stage === "ENGINEER_VISIT") {
      try {
        const visits = await getProjectVisits(project.id);
        const scheduled = visits.find((v) => v.status === "SCHEDULED");
        if (scheduled) { setCompleteModal({ project, visit: scheduled }); return; }
        // If no scheduled visit but completed exists → allow direct transition
      } catch (e) {
        alert("Could not fetch visit details.");
        return;
      }
    }

    // Default transition
    try {
      await transitionProject(project.id, { targetStage: nextStage });
      await loadProjects();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Stage update failed");
    }
  };

  const confirmVisitSchedule = async (visitDate: string, engineerEmail?: string) => {
    if (!visitModal) return;
    setVisitLoading(true);
    try {
      await transitionProject(visitModal.project.id, {
        targetStage: "ENGINEER_VISIT",
        visitDate,
        engineerEmail,
      });
      setVisitModal(null);
      await loadProjects();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to schedule visit");
    } finally { setVisitLoading(false); }
  };

  const confirmVisitComplete = async (imageBase64: string, remarks: string) => {
    if (!completeModal) return;
    setCompleteLoading(true);
    try {
      await completeVisit(completeModal.visit.id, {
        visitImageUrl: imageBase64, // base64 data URL stored as image reference
        remarks,
      });
      setCompleteModal(null);
      await loadProjects();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? "Failed to complete visit");
    } finally { setCompleteLoading(false); }
  };

  // ✅ Handle certificate creation
  const confirmCertificateCreate = async (certificate: CertificationResponse) => {
    setCertLoading(true);
    try {
      setCertModal(null);
      // Reload projects to refresh the UI
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
                <th className="p-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const nextStage = getNextStage(project.stage);
                let actionLabel = "Move Next";
                if (!nextStage) actionLabel = "Completed";
                else if (nextStage === "ENGINEER_VISIT") actionLabel = "Schedule Visit";
                else if (nextStage === "DOCUMENT_UPLOAD" && project.stage === "ENGINEER_VISIT") actionLabel = "Complete Visit";
                else if (nextStage === "LICENSE_GRANTED") actionLabel = "Create Certificate";

                return (
                  <tr key={project.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{project.projectName}</td>
                    <td className="p-3">{project.certificationType}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${stageBadge(project.stage)}`}>
                        {stageLabel(project.stage)}
                      </span>
                    </td>
                    <td className="p-3">{project.teamName ?? "—"}</td>
                    <td className="p-3">{project.engineerEmail ?? "—"}</td>
                    <td className="p-3">{project.deadline ?? "—"}</td>
                    <td className="p-3">
                      <button
                        disabled={!nextStage}
                        onClick={() => nextStage && moveStage(project, nextStage)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white ${
                          !nextStage                       ? "bg-gray-300 cursor-not-allowed"
                          : nextStage === "ENGINEER_VISIT"  ? "bg-orange-500 hover:bg-orange-600"
                          : nextStage === "DOCUMENT_UPLOAD" && project.stage === "ENGINEER_VISIT"
                                                            ? "bg-green-600 hover:bg-green-700"
                          : nextStage === "LICENSE_GRANTED" ? "bg-green-600 hover:bg-green-700"
                          : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-gray-400">No projects found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {visitModal && (
        <EngineerVisitModal
          project={visitModal.project}
          onConfirm={confirmVisitSchedule}
          onClose={() => setVisitModal(null)}
          loading={visitLoading}
        />
      )}

      {completeModal && (
        <CompleteVisitModal
          visit={completeModal.visit}
          onConfirm={confirmVisitComplete}
          onClose={() => setCompleteModal(null)}
          loading={completeLoading}
        />
      )}

      {/* ✅ Certificate Modal */}
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