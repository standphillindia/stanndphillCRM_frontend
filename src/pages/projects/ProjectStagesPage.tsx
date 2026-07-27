// src/pages/projects/ProjectStagesPage.tsx
//
// Timeline view of the day-wise 45-day stage tracker for one project.
// Groups are shown top-to-bottom in order; stages that share a groupOrder
// (parallel work, e.g. Day 1's WhatsApp Group + Engineer Reading) render
// side by side.

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  fetchProjectStages,
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

  const [engFailModalOpen, setEngFailModalOpen] = useState(false);
  const [engFailReason, setEngFailReason] = useState("");

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

    if (stage.stageCode === "AUDIT_SCHEDULE") {
      setAuditModalOpen(true);
      return;
    }
    if (stage.stageCode === "CLIENT_VISIT_ENG") {
      const visitState = parseEngineerVisitState(stage.validationData);
      if (visitState.visitStatus === "SCHEDULED") {
        setEngCompleteModalOpen(true);
      } else {
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
      showToast("Visit scheduled — due date updated.");
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
      await load();
      showToast("Visit completed — sample marked sent to lab.");
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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/projects" className="text-sm text-blue-600 hover:underline">← Back to Projects</Link>
          <h1 className="text-3xl font-bold mt-1">{projectName}</h1>
          <p className="text-gray-500">45-Day Stage Timeline</p>
        </div>
      </div>

      {stages.length === 0 && (
        <div className="rounded-lg border bg-white p-6 text-gray-400 text-center">
          No stage tracker found for this project — it may have been created before the day-wise tracker was enabled.
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([groupOrder, rows]) => (
          <div key={groupOrder} className="rounded-lg border bg-white p-4">
            <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
              Group {groupOrder}
            </div>
            <div className={`grid gap-3 ${rows.length > 1 ? "md:grid-cols-2" : ""}`}>
              {rows.map((s) => (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 ${s.status === "LATE" ? "border-red-300 bg-red-50" : "border-gray-200"}`}
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

                  {s.status === "IN_PROGRESS" && !s.accessLocked && (
                    <button
                      disabled={busyStage === s.stageCode}
                      onClick={() => handleComplete(s)}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
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

                  {s.status === "LATE" && !s.accessLocked && (
                    <button
                      disabled={busyStage === s.stageCode}
                      onClick={() => handleComplete(s)}
                      className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
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

      {auditModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-semibold mb-1">Schedule Factory Visit</h2>
            <label className="block text-sm text-gray-600 mb-1 mt-3">Visit Date</label>
            <input
              type="date"
              value={engVisitDate}
              onChange={(e) => setEngVisitDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">
              This becomes the due date. Once visited, come back to log the result (photo required) or mark
              it failed to reschedule.
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
                {busyStage === "CLIENT_VISIT_ENG" ? "Saving…" : "Schedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {engCompleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
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