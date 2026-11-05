// src/pages/projects/ProjectStagesPage.tsx
//
// Timeline view of the day-wise 45-day stage tracker for one project.
// Groups are shown top-to-bottom in order; stages that share a groupOrder
// (parallel work, e.g. Day 1's WhatsApp Group + Engineer Reading) render
// side by side.

import { useEffect, useState } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchProjectStages,
  completeStage,
  submitAuditSchedule,
  scheduleEngineerVisit,
  completeEngineerVisit,
  failEngineerVisit,
  uploadVisitPhoto,
  parseEngineerVisitState,
  needsLateRemark,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import StageRemarksModal from "../../components/projects/StageRemarksModal";
import VisitReportViewModal from "../../components/projects/VisitReportViewModal";
import { getVisitReport, type VisitReport } from "../../services/visitReportService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { visitActionFor, visitButtonLabel, visitDateLabel, visitRoles } from "../../utils/visitPermissions";
import VisitApprovalModal from "../../components/projects/VisitApprovalModal";

function statusBadge(status: StageTrackerResponse["status"]) {
  switch (status) {
    case "DONE": return "bg-green-100 text-green-700";
    case "LATE": return "bg-red-100 text-red-700";
    case "IN_PROGRESS": return "bg-blue-100 text-blue-700";
    default: return "bg-gray-100 text-gray-500";
  }
}

function groupByOrder(stages: StageTrackerResponse[]) {
  const map = new Map<number, StageTrackerResponse[]>();
  for (const s of stages) {
    const arr = map.get(s.groupOrder) ?? [];
    arr.push(s);
    map.set(s.groupOrder, arr);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

export default function ProjectStagesPage() {
  const { id } = useParams<{ id: string }>();
  const { addToast } = useToast();
  // Group 8 visit: Ops schedules, Engineer logs the result (Admin both).
  const { token } = useAuth();
  const navigate = useNavigate();
  const showToast = (message: string, type: "success" | "error" = "success") =>
    addToast({ title: type === "error" ? "Error" : "Success", message, type });

  const [stages, setStages] = useState<StageTrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStage, setBusyStage] = useState<string | null>(null);

  // Audit popup form state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [clientName, setClientName] = useState("");

  // Engineer factory-visit lifecycle state
  const [engScheduleModalOpen, setEngScheduleModalOpen] = useState(false);
  const [engVisitDate, setEngVisitDate] = useState("");

  const [engCompleteModalOpen, setEngCompleteModalOpen] = useState(false);
  const [engPhotoFile, setEngPhotoFile] = useState<File | null>(null);
  const [engCompleteNotes, setEngCompleteNotes] = useState("");
  const [engUploading, setEngUploading] = useState(false);

  // Admin: approve / change / cancel a requested factory visit.
  const [approvalFor, setApprovalFor] = useState<StageTrackerResponse | null>(null);

  const [engFailModalOpen, setEngFailModalOpen] = useState(false);
  const [engFailReason, setEngFailReason] = useState("");

  // Stage notes. late = opened from Mark Done on a late stage with no
  // delay note yet; saving the note then carries on with Mark Done.
  const [notesFor, setNotesFor] = useState<{ stage: StageTrackerResponse; late: boolean } | null>(null);

  // Factory-visit document checklist + basic info (filled by the engineer
  // after logging the visit). Documents marked "No" blink for Admin.
  const [visitReport, setVisitReport] = useState<VisitReport | null>(null);
  const [visitReportOpen, setVisitReportOpen] = useState(false);
  const canEditVisitReport = visitRoles(token).isAdmin || visitRoles(token).isEngineer;
  // Approve / change / cancel a factory visit, and schedule without approval:
  // Admin, or "Factory visit approvals" with Edit in Roles & Permissions.
  const perms = usePermissions();
  const canApproveVisits = visitRoles(token).isAdmin || perms.can("VISIT_APPROVALS", "EDIT");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getVisitReport(id)
      .then((r) => { if (!cancelled) setVisitReport(r); })
      .catch(() => { /* not critical — the stage page still works without it */ });
    return () => { cancelled = true; };
  }, [id]);

  const load = async () => {
    if (!id) return;
    try {
      const data = await fetchProjectStages(id);
      setStages(data);
    } catch (err) {
      console.error(err);
      showToast("Could not load project stages.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleComplete = async (stage: StageTrackerResponse) => {
    if (!id) return;

    // A late stage must say why before it is done. Scheduling a factory
    // visit is not "done", so only the visit result needs the reason.
    const finishes = stage.stageCode !== "CLIENT_VISIT_ENG"
      || visitActionFor(token, stage.validationData) === "log-result";
    if (finishes && needsLateRemark(stage)) {
      setNotesFor({ stage, late: true });
      return;
    }

    if (stage.stageCode === "AUDIT_SCHEDULE") {
      setAuditModalOpen(true);
      return;
    }
    if (stage.stageCode === "CLIENT_VISIT_ENG") {
      const action = visitActionFor(token, stage.validationData);
      if (action === "log-result") {
        setEngCompleteModalOpen(true);
      } else if (action === "approve") {
        setApprovalFor(stage);
      } else if (action === "schedule" || action === "reschedule" || action === "change-request") {
        setEngScheduleModalOpen(true);
      }
      return;
    }

    let notes: string | undefined;
    if (stage.validationType === "DOCUMENT_UPLOAD") {
      notes = window.prompt("Attach a reference (file name / lab PI number):") ?? undefined;
      if (notes === undefined) return; // cancelled
    } else if (stage.validationType === "EXTERNAL_PAYMENT_CONFIRM") {
      const ok = window.confirm(
        `Confirm: client has paid on the external portal for "${stage.displayName}"?`
      );
      if (!ok) return;
    }

    setBusyStage(stage.stageCode);
    try {
      await completeStage(id, stage.stageCode, { notes });
      await load();
      showToast(`Marked done: ${stage.displayName}`);
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not complete this stage.", "error");
    } finally {
      setBusyStage(null);
    }
  };

  const handleAuditSubmit = async () => {
    if (!id || !visitDate || !clientName.trim()) {
      showToast("Visit date and client name are required.", "error");
      return;
    }
    setBusyStage("AUDIT_SCHEDULE");
    try {
      await submitAuditSchedule(id, { visitDate, clientName: clientName.trim() });
      setAuditModalOpen(false);
      setVisitDate("");
      setClientName("");
      await load();
      showToast("Audit scheduled.");
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not schedule the audit.", "error");
    } finally {
      setBusyStage(null);
    }
  };

  const handleEngScheduleSubmit = async () => {
    if (!id || !engVisitDate) {
      showToast("Visit date is required.", "error");
      return;
    }
    setBusyStage("CLIENT_VISIT_ENG");
    try {
      await scheduleEngineerVisit(id, { visitDate: engVisitDate });
      setEngScheduleModalOpen(false);
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
      setBusyStage(null);
    }
  };

  const handleEngCompleteSubmit = async () => {
    if (!id || !engPhotoFile) {
      showToast("A photo of the packed sample box is required.", "error");
      return;
    }
    setBusyStage("CLIENT_VISIT_ENG");
    setEngUploading(true);
    try {
      const photoUrl = await uploadVisitPhoto(engPhotoFile);
      await completeEngineerVisit(id, { photoUrl, notes: engCompleteNotes.trim() || undefined });
      setEngCompleteModalOpen(false);
      setEngPhotoFile(null);
      setEngCompleteNotes("");
      showToast("Visit completed — sample marked sent to lab.");
      // The engineer fills the document checklist + basic info next, then
      // the visit expense (3-day window).
      if (!visitRoles(token).isAdmin) {
        navigate(`/visit-report/${id}`);
        return;
      }
      await load();
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not complete the visit.", "error");
    } finally {
      setBusyStage(null);
      setEngUploading(false);
    }
  };

  const handleEngFailSubmit = async () => {
    if (!id) return;
    setBusyStage("CLIENT_VISIT_ENG");
    try {
      await failEngineerVisit(id, { reason: engFailReason.trim() || undefined });
      setEngFailModalOpen(false);
      setEngFailReason("");
      await load();
      showToast("Visit marked failed — please reschedule.");
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? "Could not update the visit.", "error");
    } finally {
      setBusyStage(null);
    }
  };

  if (loading) return <div className="p-6">Loading project timeline…</div>;

  const grouped = groupByOrder(stages);
  const projectName = stages[0]?.projectName ?? "Project";

  // Summary for the top of the page (handy on a phone).
  const stageCounts = {
    done: stages.filter((x) => x.status === "DONE").length,
    late: stages.filter((x) => x.status === "LATE").length,
    now: stages.filter((x) => x.status === "IN_PROGRESS").length,
  };
  const stagesLeft = stages.length - stageCounts.done - stageCounts.late - stageCounts.now;

  return (
    <div className="p-0 lg:p-6">
      <div className="mb-4 lg:mb-6 flex items-center justify-between">
        <div className="min-w-0">
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">← Back to Projects</Link>
          <h1 className="text-xl lg:text-3xl font-bold mt-1 break-words">{projectName}</h1>
          <p className="text-gray-500">45-Day Stage Timeline</p>
          {stages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800">Done {stageCounts.done}</span>
              {stageCounts.late > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700">Late {stageCounts.late}</span>
              )}
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">In progress {stageCounts.now}</span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Left {stagesLeft}</span>
            </div>
          )}
        </div>
      </div>

      {stages.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-400 text-center">
          No stage tracker found for this project — it may have been created before the day-wise tracker was enabled.
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([groupOrder, rows]) => (
          <div key={groupOrder} className="rounded-lg border bg-white p-3 sm:p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
              Group {groupOrder}
              {(() => {
                const n = rows.reduce((sum, r) => sum + (r.remarkCount ?? 0), 0);
                return n > 0 ? <span className="ml-2 normal-case font-normal text-amber-700">· {n} note{n > 1 ? "s" : ""}</span> : null;
              })()}
            </div>
            <div className={`grid gap-3 ${rows.length > 1 ? "md:grid-cols-2" : ""}`}>
              {rows.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg border p-3 sm:p-4 ${
                    s.status === "LATE" ? "border-red-300 bg-red-50" : s.status === "DONE" ? "border-gray-200 opacity-80" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{s.displayName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {s.responsibleDepartment}
                        {s.dueDate && <> · Due {s.dueDate}</>}
                        {s.daysLateOrRemaining !== null && s.status !== "DONE" && (
                          <span className={s.daysLateOrRemaining < 0 ? "text-red-600 font-medium" : ""}>
                            {" "}
                            ({s.daysLateOrRemaining < 0
                              ? `${Math.abs(s.daysLateOrRemaining)} day(s) late`
                              : `${s.daysLateOrRemaining} day(s) left`})
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </div>

                  {/* Stage notes — why it's stuck / what's pending. */}
                  <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-start gap-2">
                    {s.latestRemark ? (
                      <p className="flex-1 min-w-0 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        <span className="line-clamp-2 whitespace-pre-line">📝 {s.latestRemark}</span>
                        <span className="block text-[10px] text-gray-500 mt-0.5">
                          {s.latestRemarkBy ?? ""}
                          {s.latestRemarkAt ? ` · ${new Date(s.latestRemarkAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""}
                        </span>
                      </p>
                    ) : (
                      <span className="hidden sm:block flex-1" />
                    )}
                    <button
                      onClick={() => setNotesFor({ stage: s, late: false })}
                      className="shrink-0 px-3 py-2 sm:px-2 sm:py-1 rounded-lg sm:rounded text-sm sm:text-xs font-medium text-blue-700 border border-blue-200 bg-white hover:bg-blue-50"
                    >
                      {s.remarkCount ? `Notes (${s.remarkCount})` : "+ Add note"}
                    </button>
                  </div>

                  {s.accessLocked && (
                    <div className="mt-2 text-xs text-red-700 bg-red-100 rounded px-2 py-1">
                      🔒 Access locked — ask Admin to reauthorize before you can complete this.
                    </div>
                  )}

                  {s.status === "DONE" && (
                    <div className="mt-2 text-xs text-gray-400">
                      Completed{s.completedByName ? ` by ${s.completedByName}` : ""}
                      {s.completedAt ? ` · ${new Date(s.completedAt).toLocaleDateString()}` : ""}
                    </div>
                  )}

                  {/* Factory-visit document checklist summary. */}
                  {s.stageCode === "CLIENT_VISIT_ENG" && visitReport && (visitReport.checklistSubmittedAt || s.status === "DONE") && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {visitReport.checklistSubmittedAt ? (
                        <>
                          <span className="text-gray-600">📋 Documents:</span>
                          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800">Yes {visitReport.checklistYes}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              visitReport.checklistNo ? "bg-red-600 text-white font-semibold animate-pulse" : "bg-red-100 text-red-800"
                            }`}
                          >
                            No {visitReport.checklistNo}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">N.A. {visitReport.checklistNa}</span>
                          {!visitReport.basicInfoSubmittedAt && <span className="text-amber-700">· Basic info pending</span>}
                        </>
                      ) : (
                        <span className="text-amber-700">📋 Document checklist not filled yet</span>
                      )}
                      {canEditVisitReport && (!visitReport.checklistSubmittedAt || !visitReport.basicInfoSubmittedAt) ? (
                        <Link
                          to={`/visit-report/${s.projectId}`}
                          className="ml-auto px-2 py-1 rounded font-medium text-white bg-amber-600 hover:bg-amber-700"
                        >
                          {visitReport.basicInfoSubmittedAt ? "Fill checklist" : "Fill basic info"}
                        </Link>
                      ) : null}
                      <button
                        onClick={() => setVisitReportOpen(true)}
                        className={`${canEditVisitReport && (!visitReport.checklistSubmittedAt || !visitReport.basicInfoSubmittedAt) ? "" : "ml-auto "}px-2 py-1 rounded font-medium text-blue-700 border border-blue-200 hover:bg-blue-50`}
                      >
                        View checklist
                      </button>
                    </div>
                  )}

                  {/* Group 8 factory visit — its own buttons (Ops schedules,
                      Engineer logs the result). */}
                  {s.stageCode === "CLIENT_VISIT_ENG" && (s.status === "IN_PROGRESS" || s.status === "LATE") && !s.accessLocked && (() => {
                    const action = visitActionFor(token, s.validationData);
                    const visit = parseEngineerVisitState(s.validationData);
                    return (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {visit.visitStatus === "PENDING_APPROVAL" && (
                          <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 w-fit">
                            ⏳ Visit requested for {visitDateLabel(visit.requestedDate ?? visit.visitDate)}
                            {visit.requestedBy ? ` by ${visit.requestedBy}` : ""} — waiting for Admin approval
                          </span>
                        )}
                        {visit.visitStatus === "SCHEDULED" && visit.visitDate && (
                          <span className="text-xs text-blue-700">
                            📅 Visit scheduled for {visitDateLabel(visit.visitDate)}
                            {visit.approvedBy ? ` · approved by ${visit.approvedBy}` : ""}
                            {action === "reschedule" ? " — Engineer will log the result" : ""}
                          </span>
                        )}
                        {visit.visitStatus === "FAILED" && (
                          <span className="text-xs text-red-700">Last visit failed — pick a new date</span>
                        )}
                        {visit.visitStatus === "CANCELLED" && (
                          <span className="text-xs text-red-700">
                            Visit cancelled{visit.cancelledBy ? ` by ${visit.cancelledBy}` : ""}
                            {visit.notes ? `: ${visit.notes}` : ""} — request a new date
                          </span>
                        )}
                        {action === "none" ? (
                          <span className="text-xs text-gray-500">Operations schedules this visit; the Engineer logs the result.</span>
                        ) : (
                          <button
                            disabled={busyStage === s.stageCode}
                            onClick={() => handleComplete(s)}
                            className={`w-full sm:w-fit px-3 py-3 sm:py-1.5 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold sm:font-medium text-white disabled:opacity-50 ${
                              action === "reschedule"
                                ? "bg-blue-600 hover:bg-blue-700"
                                : s.status === "LATE"
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-green-600 hover:bg-green-700"
                            }`}
                          >
                            {busyStage === s.stageCode ? "Saving…" : visitButtonLabel(action)}
                          </button>
                        )}
                        {canApproveVisits && visit.visitStatus === "SCHEDULED" && (
                          <button
                            onClick={() => setApprovalFor(s)}
                            className="w-fit text-xs font-medium text-blue-700 hover:underline"
                          >
                            Change date / engineer or cancel
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {s.stageCode !== "CLIENT_VISIT_ENG" && s.status === "IN_PROGRESS" && !s.accessLocked && (
                    <button
                      disabled={busyStage === s.stageCode}
                      onClick={() => handleComplete(s)}
                      className="mt-3 w-full sm:w-fit px-3 py-3 sm:py-1.5 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold sm:font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      {busyStage === s.stageCode
                        ? "Saving…"
                        : s.stageCode === "AUDIT_SCHEDULE"
                        ? "Schedule Audit"
                        : s.stageCode === "CLIENT_VISIT_ENG"
                        ? (parseEngineerVisitState(s.validationData).visitStatus === "SCHEDULED"
                            ? "Log Visit Result"
                            : "Schedule Visit")
                        : "Mark Done"}
                    </button>
                  )}

                  {s.stageCode !== "CLIENT_VISIT_ENG" && s.status === "LATE" && !s.accessLocked && (
                    <button
                      disabled={busyStage === s.stageCode}
                      onClick={() => handleComplete(s)}
                      className="mt-3 w-full sm:w-fit px-3 py-3 sm:py-1.5 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold sm:font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                    >
                      {busyStage === s.stageCode ? "Saving…" : "Mark Done (Late)"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {visitReportOpen && visitReport && (
        <VisitReportViewModal
          report={visitReport}
          canEdit={canEditVisitReport}
          onClose={() => setVisitReportOpen(false)}
        />
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

      {auditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-4">Schedule Audit</h2>
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
                onClick={() => setAuditModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyStage === "AUDIT_SCHEDULE"}
                onClick={handleAuditSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {busyStage === "AUDIT_SCHEDULE" ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {engScheduleModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">
              {canApproveVisits ? "Schedule Factory Visit" : "Request Factory Visit Date"}
            </h2>
            <label className="block text-sm text-gray-600 mb-1 mt-3">Visit Date</label>
            <input
              type="date"
              value={engVisitDate}
              onChange={(e) => setEngVisitDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">
              {canApproveVisits
                ? "This becomes the due date. Once visited, come back to log the result (photo required) or mark it failed to reschedule."
                : "This date goes to Admin for approval. Admin may approve it, change the date or engineer, or cancel it. Travel is booked only on the approved date."}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEngScheduleModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyStage === "CLIENT_VISIT_ENG"}
                onClick={handleEngScheduleSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {busyStage === "CLIENT_VISIT_ENG" ? "Saving…" : canApproveVisits ? "Schedule" : "Send for approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {engCompleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Log Visit Result</h2>

            <label className="block text-sm text-gray-600 mb-1 mt-3">Photo of packed sample box *</label>
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
                onClick={() => { setEngFailModalOpen(true); setEngCompleteModalOpen(false); }}
                className="px-3 py-1.5 rounded-lg text-sm text-red-700 bg-red-50 hover:bg-red-100"
              >
                Visit Failed Instead
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEngCompleteModalOpen(false); setEngPhotoFile(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  disabled={busyStage === "CLIENT_VISIT_ENG" || engUploading}
                  onClick={handleEngCompleteSubmit}
                  className="px-3 py-1.5 rounded-lg text-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {engUploading ? "Uploading…" : busyStage === "CLIENT_VISIT_ENG" ? "Saving…" : "Complete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {engFailModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Mark Visit Failed</h2>
            <label className="block text-sm text-gray-600 mb-1 mt-3">Reason (optional)</label>
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
                onClick={() => setEngFailModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                disabled={busyStage === "CLIENT_VISIT_ENG"}
                onClick={handleEngFailSubmit}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {busyStage === "CLIENT_VISIT_ENG" ? "Saving…" : "Mark Failed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}