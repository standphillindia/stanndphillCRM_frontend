// src/pages/tasks/MyTasksPage.tsx
//
// Every department (Operations, Engineering, Finance, ADMIN) lands here to
// see exactly what stage-tracker work is on them right now, across all
// projects — this is the "task section" for OPS/ENG/ACCOUNT/ADMIN.
//
// GET /api/my-tasks resolves the caller's department from the JWT
// automatically, so no department param is sent by default.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchMyTasks,
  completeStage,
  submitAuditSchedule,
  scheduleEngineerVisit,
  completeEngineerVisit,
  failEngineerVisit,
  uploadVisitPhoto,
  parseEngineerVisitState,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import { useToast } from "../../context/ToastContext";

export default function MyTasksPage() {
  const { addToast } = useToast();
  const showToast = (message: string, type: "success" | "error" = "success") =>
    addToast({ title: type === "error" ? "Error" : "Success", message, type });

  const [tasks, setTasks] = useState<StageTrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [auditModalFor, setAuditModalFor] = useState<StageTrackerResponse | null>(null);
  const [visitDate, setVisitDate] = useState("");
  const [clientName, setClientName] = useState("");

  const [engScheduleModalFor, setEngScheduleModalFor] = useState<StageTrackerResponse | null>(null);
  const [engVisitDate, setEngVisitDate] = useState("");

  const [engCompleteModalFor, setEngCompleteModalFor] = useState<StageTrackerResponse | null>(null);
  const [engPhotoFile, setEngPhotoFile] = useState<File | null>(null);
  const [engCompleteNotes, setEngCompleteNotes] = useState("");
  const [engUploading, setEngUploading] = useState(false);

  const [engFailModalFor, setEngFailModalFor] = useState<StageTrackerResponse | null>(null);
  const [engFailReason, setEngFailReason] = useState("");

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

  const handleComplete = async (task: StageTrackerResponse) => {
    if (task.stageCode === "AUDIT_SCHEDULE") {
      setAuditModalFor(task);
      return;
    }
    if (task.stageCode === "CLIENT_VISIT_ENG") {
      const visitState = parseEngineerVisitState(task.validationData);
      if (visitState.visitStatus === "SCHEDULED") {
        // Already scheduled — this click means "log the result".
        setEngCompleteModalFor(task);
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
      showToast("Visit scheduled — due date updated.");
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
      setEngCompleteModalFor(null);
      setEngPhotoFile(null);
      setEngCompleteNotes("");
      await load();
      showToast("Visit completed — sample marked sent to lab.");
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

  const late = tasks.filter((t) => t.status === "LATE");
  const active = tasks.filter((t) => t.status === "IN_PROGRESS");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <p className="text-gray-500">Stage-tracker items currently on your department, across all projects.</p>
      </div>

      {tasks.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-400 text-center">
          Nothing pending right now. 🎉
        </div>
      )}

      {late.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-red-700 uppercase mb-2">Late ({late.length})</h2>
          <div className="overflow-x-auto rounded-lg border bg-white mb-6">
            <TaskTable rows={late} busyId={busyId} onComplete={handleComplete} late />
          </div>
        </>
      )}

      {active.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">In Progress ({active.length})</h2>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <TaskTable rows={active} busyId={busyId} onComplete={handleComplete} />
          </div>
        </>
      )}

      {auditModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Schedule Factory Visit</h2>
            <p className="text-xs text-gray-500 mb-4">{engScheduleModalFor.projectName}</p>
            <label className="block text-sm text-gray-600 mb-1">Visit Date</label>
            <input
              type="date"
              value={engVisitDate}
              onChange={(e) => setEngVisitDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">
              This becomes the due date. Once you've actually visited, come back here to log the result
              (photo required) or mark it failed to reschedule.
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
                {busyId === engScheduleModalFor.id ? "Saving…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {engCompleteModalFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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

function TaskTable({
  rows,
  busyId,
  onComplete,
  late = false,
}: {
  rows: StageTrackerResponse[];
  busyId: string | null;
  onComplete: (t: StageTrackerResponse) => void;
  late?: boolean;
}) {
  return (
    <table className="w-full text-sm">
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
              {t.stageCode === "CLIENT_VISIT_ENG" && (() => {
                const vs = parseEngineerVisitState(t.validationData).visitStatus;
                if (vs === "SCHEDULED") {
                  return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Scheduled</span>;
                }
                if (vs === "FAILED") {
                  return <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">Failed — reschedule</span>;
                }
                return null;
              })()}
            </td>
            <td className="p-3">
              {t.dueDate ?? "—"}
              {t.daysLateOrRemaining !== null && (
                <span className={`ml-1 text-xs ${t.daysLateOrRemaining < 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
                  ({t.daysLateOrRemaining < 0
                    ? `${Math.abs(t.daysLateOrRemaining)}d late`
                    : `${t.daysLateOrRemaining}d left`})
                </span>
              )}
            </td>
            <td className="p-3">
              {t.accessLocked ? (
                <span className="text-xs text-red-700 bg-red-100 rounded px-2 py-1">🔒 Locked — ask Admin</span>
              ) : (
                <button
                  disabled={busyId === t.id}
                  onClick={() => onComplete(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 ${
                    late ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {busyId === t.id
                    ? "Saving…"
                    : t.stageCode === "AUDIT_SCHEDULE"
                    ? "Schedule Audit"
                    : t.stageCode === "CLIENT_VISIT_ENG"
                    ? (parseEngineerVisitState(t.validationData).visitStatus === "SCHEDULED"
                        ? "Log Visit Result"
                        : "Schedule Visit")
                    : "Mark Done"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}