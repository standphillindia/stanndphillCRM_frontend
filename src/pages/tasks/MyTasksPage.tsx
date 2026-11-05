// src/pages/tasks/MyTasksPage.tsx
//
// Every department (Operations, Engineering, Finance, ADMIN) lands here to
// see exactly what stage-tracker work is on them right now, across all
// projects — this is the "task section" for OPS/ENG/ACCOUNT/ADMIN.
//
// GET /api/my-tasks resolves the caller's department from the JWT
// automatically, so no department param is sent by default.

import { useEffect, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchMyTasks,
  completeStage,
  submitAuditSchedule,
  scheduleEngineerVisit,
  completeEngineerVisit,
  failEngineerVisit,
  uploadVisitPhoto,
  parseEngineerVisitState,
  runLateCheckNow,
  needsLateRemark,
  isOldProjectStage,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import StageRemarksModal from "../../components/projects/StageRemarksModal";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getRoleFromToken, decodeJwt } from "../../utils/jwt";
import { visitActionFor, visitButtonLabel, visitRoles } from "../../utils/visitPermissions";
import VisitApprovalModal from "../../components/projects/VisitApprovalModal";
import VisitApprovalsBanner from "../../components/projects/VisitApprovalsBanner";
import PendingVisitReportsBanner from "../../components/projects/PendingVisitReportsBanner";

export default function MyTasksPage() {
  const { addToast } = useToast();
  const showToast = (message: string, type: "success" | "error" = "success") =>
    addToast({ title: type === "error" ? "Error" : "Success", message, type });

  const { token } = useAuth();
  const navigate = useNavigate();
  const isAdmin = getRoleFromToken(token) === "ADMIN";
  // Approve / cancel factory visit dates (and schedule without approval):
  // Admin, or "Factory visit approvals" with Edit in Roles & Permissions.
  const perms = usePermissions();
  const canApproveVisits = isAdmin || perms.can("VISIT_APPROVALS", "EDIT");
  const myEmail = decodeJwt(token)?.sub ?? "";
  const [checkingNow, setCheckingNow] = useState(false);

  const [tasks, setTasks] = useState<StageTrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [auditModalFor, setAuditModalFor] = useState<StageTrackerResponse | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [clientName, setClientName] = useState("");

  const [engScheduleModalFor, setEngScheduleModalFor] = useState<StageTrackerResponse | null>(null);
  // Admin: approve / change / cancel a requested factory visit.
  const [approvalFor, setApprovalFor] = useState<StageTrackerResponse | null>(null);
  const [engVisitDate, setEngVisitDate] = useState("");

  const [engCompleteModalFor, setEngCompleteModalFor] = useState<StageTrackerResponse | null>(null);
  const [engPhotoFile, setEngPhotoFile] = useState<File | null>(null);
  const [engCompleteNotes, setEngCompleteNotes] = useState("");
  const [engUploading, setEngUploading] = useState(false);

  const [engFailModalFor, setEngFailModalFor] = useState<StageTrackerResponse | null>(null);
  const [engFailReason, setEngFailReason] = useState("");

  // Stage notes. late = opened from Mark Done on a late stage with no
  // delay note yet; saving the note then carries on with Mark Done.
  const [notesFor, setNotesFor] = useState<{ stage: StageTrackerResponse; late: boolean } | null>(null);

  // New / Old projects — old projects' stages are kept in their own section.
  const [projectView, setProjectView] = useState<"NEW" | "OLD">("NEW");

  const load = async () => {
    try {
      const data = await fetchMyTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
      showToast("Could not load your tasks.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCheckNow = async () => {
    setCheckingNow(true);
    try {
      const { flaggedCount } = await runLateCheckNow();
      showToast(
        flaggedCount > 0
          ? `Late-check ran — ${flaggedCount} stage(s) flagged/locked.`
          : "Late-check ran — nothing new to flag."
      );
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not run the late-check.", "error");
    } finally {
      setCheckingNow(false);
    }
  };

  const handleComplete = async (task: StageTrackerResponse) => {
    // A late stage must say why before it is done. Scheduling a factory
    // visit is not "done", so only the visit result needs the reason.
    const finishes = task.stageCode !== "CLIENT_VISIT_ENG"
      || visitActionFor(token, task.validationData) === "log-result";
    if (finishes && needsLateRemark(task)) {
      setNotesFor({ stage: task, late: true });
      return;
    }

    if (task.stageCode === "AUDIT_SCHEDULE") {
      setAuditModalFor(task);
      return;
    }
    if (task.stageCode === "CLIENT_VISIT_ENG") {
      // Ops: schedule / reschedule only. Engineer & Admin: schedule, then
      // log the result once it's scheduled.
      const action = visitActionFor(token, task.validationData);
      if (action === "none") return;
      if (action === "log-result") {
        // Already scheduled — this click means "log the result".
        setEngCompleteModalFor(task);
      } else if (action === "approve") {
        // Admin: a requested date waiting for approval.
        setApprovalFor(task);
      } else {
        // Not scheduled yet (or a previous attempt failed) — pick a date.
        setEngScheduleModalFor(task);
      }
      return;
    }

    let notes: string | undefined;
    if (task.validationType === "DOCUMENT_UPLOAD") {
      notes = window.prompt("Attach a reference (file name / lab PI number):") ?? undefined;
      if (notes === undefined) return;
    } else if (task.validationType === "EXTERNAL_PAYMENT_CONFIRM") {
      const ok = window.confirm(`Confirm: client has paid on the external portal for "${task.displayName}"?`);
      if (!ok) return;
    }

    setBusyId(task.id);
    try {
      await completeStage(task.projectId, task.stageCode, { notes });
      await load();
      showToast(`Marked done: ${task.displayName}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not complete this task.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleAuditSubmit = async () => {
    if (!auditModalFor || !visitDate || !clientName.trim()) {
      showToast("Visit date and client name are required.", "error");
      return;
    }
    setBusyId(auditModalFor.id);
    try {
      await submitAuditSchedule(auditModalFor.projectId, { visitDate, clientName: clientName.trim() });
      setAuditModalFor(null);
      setVisitDate("");
      setClientName("");
      await load();
      showToast("Audit scheduled.");
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not schedule the audit.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleEngScheduleSubmit = async () => {
    if (!engScheduleModalFor || !engVisitDate) {
      showToast("Visit date is required.", "error");
      return;
    }
    setBusyId(engScheduleModalFor.id);
    try {
      await scheduleEngineerVisit(engScheduleModalFor.projectId, { visitDate: engVisitDate });
      setEngScheduleModalFor(null);
      setEngVisitDate("");
      await load();
      showToast(
        canApproveVisits
          ? "Visit scheduled — due date updated."
          : "Visit date sent to Admin for approval. You'll be notified once it's approved."
      );
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not schedule the visit.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleEngCompleteSubmit = async () => {
    if (!engCompleteModalFor || !engPhotoFile) {
      showToast("A photo of the packed sample box is required.", "error");
      return;
    }
    setBusyId(engCompleteModalFor.id);
    setEngUploading(true);
    try {
      const photoUrl = await uploadVisitPhoto(engPhotoFile);
      await completeEngineerVisit(engCompleteModalFor.projectId, {
        photoUrl,
        notes: engCompleteNotes.trim() || undefined,
      });
      const visitProjectId = engCompleteModalFor.projectId;
      setEngCompleteModalFor(null);
      setEngPhotoFile(null);
      setEngCompleteNotes("");
      showToast("Visit completed — sample marked sent to lab.");
      // The engineer fills the document checklist + basic info next, then
      // the visit expense (3-day window).
      if (!isAdmin) {
        navigate(`/visit-report/${visitProjectId}`);
        return;
      }
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not complete the visit.", "error");
    } finally {
      setBusyId(null);
      setEngUploading(false);
    }
  };

  const handleEngFailSubmit = async () => {
    if (!engFailModalFor) return;
    setBusyId(engFailModalFor.id);
    try {
      await failEngineerVisit(engFailModalFor.projectId, { reason: engFailReason.trim() || undefined });
      setEngFailModalFor(null);
      setEngFailReason("");
      await load();
      showToast("Visit marked failed — please reschedule.");
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not update the visit.", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="p-6">Loading your tasks…</div>;

  const oldCount = tasks.filter((t) => isOldProjectStage(t)).length;
  const newCount = tasks.length - oldCount;
  const viewTasks = tasks.filter((t) => (projectView === "OLD") === isOldProjectStage(t));
  const late = viewTasks.filter((t) => t.status === "LATE");
  const active = viewTasks.filter((t) => t.status === "IN_PROGRESS");

  return (
    <div className="p-0 lg:p-6">
      <div className="mb-4 lg:mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">My Tasks</h1>
          <p className="text-gray-500">Stage-tracker items currently on your department, across all projects.</p>
        </div>
        {isAdmin && (
          <button
            onClick={handleCheckNow}
            disabled={checkingNow}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 flex-shrink-0"
            title="Manually run the daily LATE-detection + access-lock sweep, instead of waiting for the 1:30 AM cron"
          >
            {checkingNow ? "Checking…" : "🔄 Check Now (run late-check)"}
          </button>
        )}
      </div>

      {/* Factory visits whose checklist / basic info is still to fill. */}
      <PendingVisitReportsBanner showEngineer={isAdmin} />

      {/* Admin: factory visit dates waiting for approval. */}
      {canApproveVisits && (
        <VisitApprovalsBanner
          onChanged={(message) => {
            showToast(message);
            load();
          }}
        />
      )}

      {/* New / Old projects */}
      <div className="mb-4 flex gap-1 border-b">
        {(["NEW", "OLD"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setProjectView(v)}
            className={`flex-1 lg:flex-none px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              projectView === v ? "border-blue-700 text-blue-800" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {v === "NEW" ? "New projects" : "Old projects"}{" "}
            <span className="text-xs text-gray-400">({v === "NEW" ? newCount : oldCount})</span>
          </button>
        ))}
      </div>

      {viewTasks.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-400 text-center">
          {tasks.length === 0
            ? "Nothing pending right now. 🎉"
            : projectView === "NEW" ? "Nothing pending on new projects. 🎉" : "Nothing pending on old projects."}
        </div>
      )}

      {late.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-red-700 uppercase mb-2">Late ({late.length})</h2>
          <div className="overflow-x-auto rounded-lg border bg-white mb-6">
            <TaskTable
    rows={late}
    busyId={busyId}
    onComplete={handleComplete}
    onNotes={(t) => setNotesFor({ stage: t, late: false })}
    myEmail={myEmail}
    token={token}
    late
/>
          </div>
        </>
      )}

      {active.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">In Progress ({active.length})</h2>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <TaskTable
    rows={active}
    busyId={busyId}
    onComplete={handleComplete}
    onNotes={(t) => setNotesFor({ stage: t, late: false })}
    myEmail={myEmail}
    token={token}
/>
          </div>
        </>
      )}

      {notesFor && (
        <StageRemarksModal
          stage={notesFor.stage}
          requireLateReason={notesFor.late}
          onClose={() => { setNotesFor(null); load(); }}
          onSaved={() => {
            if (notesFor.late) {
              const stage = { ...notesFor.stage, lateRemarkGiven: true };
              setNotesFor(null);
              handleComplete(stage);
            } else {
              load();
            }
          }}
        />
      )}

      {auditModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Schedule Audit</h2>
            <p className="text-xs text-gray-500 mb-4">{auditModalFor.projectName}</p>
            <label className="block text-sm text-gray-600 mb-1">Visit Date</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            />
            <label className="block text-sm text-gray-600 mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="Client / company contact name"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAuditModalFor(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyId === auditModalFor.id}
                onClick={handleAuditSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === auditModalFor.id ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {engScheduleModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">
              {canApproveVisits ? "Schedule Factory Visit" : "Request Factory Visit Date"}
            </h2>
            <p className="text-xs text-gray-500 mb-4">{engScheduleModalFor.projectName}</p>
            <label className="block text-sm text-gray-600 mb-1">Visit Date</label>
            <input
              type="date"
              value={engVisitDate}
              onChange={(e) => setEngVisitDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">
              {canApproveVisits
                ? "This becomes the due date. Once you've actually visited, come back here to log the result (photo required) or mark it failed to reschedule."
                : "This date goes to Admin for approval. Admin may approve it, change the date or engineer, or cancel it. Travel is booked only on the approved date."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEngScheduleModalFor(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyId === engScheduleModalFor.id}
                onClick={handleEngScheduleSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {busyId === engScheduleModalFor.id ? "Saving…" : canApproveVisits ? "Schedule" : "Send for approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {approvalFor && (
        <VisitApprovalModal
          stage={approvalFor}
          onClose={() => setApprovalFor(null)}
          onDone={(message) => {
            setApprovalFor(null);
            showToast(message);
            load();
          }}
        />
      )}

      {engCompleteModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Log Visit Result</h2>
            <p className="text-xs text-gray-500 mb-4">{engCompleteModalFor.projectName}</p>

            <label className="block text-sm text-gray-600 mb-1">Photo of packed sample box *</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setEngPhotoFile(e.target.files?.[0] ?? null)}
              className="w-full border rounded-lg px-3 py-2 mb-3 text-sm"
            />
            {engPhotoFile && (
              <img
                src={URL.createObjectURL(engPhotoFile)}
                alt="Preview"
                className="w-full h-32 object-cover rounded-lg mb-3 border"
              />
            )}

            <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={engCompleteNotes}
              onChange={(e) => setEngCompleteNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="Courier ref, anything worth noting"
            />

            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  setEngFailModalFor(engCompleteModalFor);
                  setEngCompleteModalFor(null);
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-red-700 bg-red-50 hover:bg-red-100"
              >
                Visit Failed Instead
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEngCompleteModalFor(null); setEngPhotoFile(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  disabled={busyId === engCompleteModalFor.id || engUploading}
                  onClick={handleEngCompleteSubmit}
                  className="px-3 py-1.5 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {engUploading ? "Uploading…" : busyId === engCompleteModalFor.id ? "Saving…" : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {engFailModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Mark Visit Failed</h2>
            <p className="text-xs text-gray-500 mb-4">{engFailModalFor.projectName}</p>
            <label className="block text-sm text-gray-600 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={engFailReason}
              onChange={(e) => setEngFailReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              placeholder="Client unavailable, factory closed, etc."
            />
            <p className="text-xs text-gray-500 mb-4">Admin will be notified. You'll need to schedule a new date.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEngFailModalFor(null)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyId === engFailModalFor.id}
                onClick={handleEngFailSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {busyId === engFailModalFor.id ? "Saving…" : "Mark Failed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type TaskListProps = {
  rows: StageTrackerResponse[];
  busyId: string | null;
  onComplete: (t: StageTrackerResponse) => void;
  onNotes: (t: StageTrackerResponse) => void;
  myEmail: string;
  token: string | null;
  late?: boolean;
};

/** Factory-visit status chip next to the stage name (Group 8 only). */
function VisitBadge({ t }: { t: StageTrackerResponse }) {
  if (t.stageCode !== "CLIENT_VISIT_ENG") return null;
  const vs = parseEngineerVisitState(t.validationData).visitStatus;
  if (vs === "PENDING_APPROVAL") {
    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Awaiting Admin approval</span>;
  }
  if (vs === "SCHEDULED") {
    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Scheduled</span>;
  }
  if (vs === "CANCELLED") {
    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Cancelled — request a new date</span>;
  }
  if (vs === "FAILED") {
    return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Failed — reschedule</span>;
  }
  return null;
}

/** "(2d late)" / "(3d left)" after the due date. */
function DueText({ t }: { t: StageTrackerResponse }) {
  if (t.daysLateOrRemaining === null || t.daysLateOrRemaining === undefined) return null;
  return (
    <span className={`ml-1 text-xs ${t.daysLateOrRemaining < 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
      ({t.daysLateOrRemaining < 0
        ? `${Math.abs(t.daysLateOrRemaining)}d late`
        : `${t.daysLateOrRemaining}d left`})
    </span>
  );
}

/**
 * The action for one task — the same rules on the desktop table and the
 * phone cards. `big` makes it a full-width button for thumbs.
 */
function TaskAction({
  t, busyId, onComplete, myEmail, token, late, big = false,
}: Omit<TaskListProps, "rows" | "onNotes"> & { t: StageTrackerResponse; big?: boolean }) {
  if (t.accessLocked) {
    return <span className="text-xs text-red-700 bg-red-100 rounded px-2 py-1 inline-block">🔒 Locked — ask Admin</span>;
  }
  // Check if this stage is assigned to a specific person
  // assignedUserEmail comes from backend (engineer or opsPerson on the project)
  const assignedEmail = (t as StageTrackerResponse & { assignedUserEmail?: string }).assignedUserEmail;
  // Group 8 factory visit: the Ops person schedules it even
  // though the stage is the engineer's.
  const visitAction = t.stageCode === "CLIENT_VISIT_ENG"
    ? visitActionFor(token, t.validationData)
    : null;
  const opsCanSchedule = visitRoles(token).isOps
    && (visitAction === "schedule" || visitAction === "reschedule" || visitAction === "change-request");
  const isAssignedToMe = !assignedEmail || assignedEmail === myEmail || opsCanSchedule;

  if (!isAssignedToMe) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          🔒 Assigned to another person
        </span>
        <span className="text-[10px] text-gray-400">
          Only {assignedEmail?.split("@")[0]} can complete this
        </span>
      </div>
    );
  }

  if (visitAction === "none") {
    return <span className="text-xs text-gray-500">Ops schedules · Engineer logs result</span>;
  }

  return (
    <button
      disabled={busyId === t.id}
      onClick={() => onComplete(t)}
      className={`${big ? "w-full py-3 text-base font-bold rounded-xl" : "px-3 py-1.5 text-xs font-medium rounded-lg"} text-white disabled:opacity-50 ${
        late ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
      }`}
    >
      {busyId === t.id
        ? "Saving…"
        : t.stageCode === "AUDIT_SCHEDULE"
        ? "Schedule Audit"
        : visitAction
        ? visitButtonLabel(visitAction)
        : "Mark Done"}
    </button>
  );
}

/** Latest stage note inline + the Notes button. */
function TaskNotes({ t, onNotes }: { t: StageTrackerResponse; onNotes: (t: StageTrackerResponse) => void }) {
  return (
    <>
      {t.latestRemark && (
        <p className="mt-1 text-xs text-gray-600 line-clamp-2 whitespace-pre-line" title={t.latestRemark}>
          📝 {t.latestRemark}
          {t.latestRemarkBy && <span className="text-gray-400"> — {t.latestRemarkBy}</span>}
        </p>
      )}
      <button
        onClick={() => onNotes(t)}
        className="block mt-1 text-xs font-medium text-blue-700 hover:underline"
      >
        {t.remarkCount ? `Notes (${t.remarkCount})` : "+ Add note"}
      </button>
    </>
  );
}

/**
 * Tasks as cards on a phone, as a table on a laptop (lg and up). Both use
 * the same badge, due-date, notes and action pieces above, so the rules
 * can't drift apart between the two.
 */
function TaskTable({ rows, busyId, onComplete, onNotes, myEmail, token, late = false }: TaskListProps) {
  return (
    <>
      {/* Phone / tablet: one card per task, big thumb-sized button. */}
      <div className="lg:hidden divide-y">
        {rows.map((t) => (
          <div
            key={t.id}
            className={`p-4 border-l-4 ${late ? "border-red-600 bg-red-50/40" : "border-blue-600"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link to={`/projects/${t.projectId}/stages`} className="font-bold text-[15px] leading-snug text-gray-900">
                {t.projectName}
              </Link>
              {t.daysLateOrRemaining !== null && t.daysLateOrRemaining !== undefined && (
                <span
                  className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    t.daysLateOrRemaining < 0 ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.daysLateOrRemaining < 0
                    ? `${Math.abs(t.daysLateOrRemaining)}d late`
                    : `${t.daysLateOrRemaining}d left`}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-700">
              {t.displayName}
              <VisitBadge t={t} />
            </div>
            <div className="mt-1 text-xs text-gray-500">📅 Due: {t.dueDate ?? "—"}</div>
            <TaskNotes t={t} onNotes={onNotes} />
            <div className="mt-3">
              <TaskAction t={t} busyId={busyId} onComplete={onComplete} myEmail={myEmail} token={token} late={late} big />
            </div>
          </div>
        ))}
      </div>

      {/* Laptop / desktop: the table, as before. */}
      <table className="hidden lg:table w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
            <th className="p-3 text-left">Project</th>
            <th className="p-3 text-left">Stage</th>
            <th className="p-3 text-left">Due</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id} className={`border-b hover:bg-gray-50 ${late ? "bg-red-50/40" : ""}`}>
              <td className="p-3 font-medium">
                <Link to={`/projects/${t.projectId}/stages`} className="text-blue-700 hover:underline">
                  {t.projectName}
                </Link>
              </td>
              <td className="p-3">
                {t.displayName}
                <VisitBadge t={t} />
                {/* Stage notes — latest one inline, full history on click. */}
                <TaskNotes t={t} onNotes={onNotes} />
              </td>
              <td className="p-3">
                {t.dueDate ?? "—"}
                <DueText t={t} />
              </td>
              <td className="p-3">
                <TaskAction t={t} busyId={busyId} onComplete={onComplete} myEmail={myEmail} token={token} late={late} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}