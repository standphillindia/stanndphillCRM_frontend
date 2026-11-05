// src/components/projects/VisitApprovalModal.tsx
//
// Admin reviews a factory visit date requested by Operations / the Engineer:
//   - Approve on the requested date, or change the date first;
//   - change the engineer who goes;
//   - or cancel the visit (reason required).
// Also opens for an already scheduled visit, to change or cancel it.
// The engineer and whoever asked are notified of the final date, which is
// what travel (train tickets) is booked on.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  approveEngineerVisit,
  cancelEngineerVisit,
  parseEngineerVisitState,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import { fetchUserDirectory, type UserResponse } from "../../services/userService";
import { visitDateLabel } from "../../utils/visitPermissions";
import { getApiErrorMessage } from "../../utils/apiError";

interface Props {
  stage: StageTrackerResponse;
  onClose: () => void;
  /** Called after approve / cancel with a short message for a toast. */
  onDone: (message: string) => void;
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";

const isEngineerUser = (u: UserResponse) =>
  u.status === "ACTIVE" && (u.role === "ENGINEER" || (u.department ?? "").toLowerCase().startsWith("engineer"));

export default function VisitApprovalModal({ stage, onClose, onDone }: Props) {
  const visit = parseEngineerVisitState(stage.validationData);
  const isPending = visit.visitStatus === "PENDING_APPROVAL";
  const requested = visit.requestedDate ?? visit.visitDate ?? "";

  const [date, setDate] = useState(visit.visitDate ?? requested);
  const currentEngineer = stage.assignedUserEmail ?? "";
  const [engineerEmail, setEngineerEmail] = useState(currentEngineer);
  const [engineers, setEngineers] = useState<UserResponse[]>([]);
  const [note, setNote] = useState("");
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserDirectory()
      .then((users) => { if (!cancelled) setEngineers(users.filter(isEngineerUser)); })
      .catch(() => { /* the current engineer still shows; changing needs the list */ });
    return () => { cancelled = true; };
  }, []);

  const approve = async () => {
    if (!date) return setError("Pick the visit date.");
    setSaving(true);
    setError(null);
    try {
      await approveEngineerVisit(stage.projectId, {
        visitDate: date,
        engineerEmail: engineerEmail && engineerEmail !== currentEngineer ? engineerEmail : undefined,
        note: note.trim() || undefined,
      });
      const who = engineers.find((e) => e.email === engineerEmail)?.fullName;
      onDone(
        `${isPending ? "Visit approved" : "Visit updated"} for ${visitDateLabel(date)}${who ? ` — ${who}` : ""}. The engineer has been notified.`
      );
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const cancelVisit = async () => {
    if (!reason.trim()) return setError("Write why the visit is cancelled.");
    setSaving(true);
    setError(null);
    try {
      await cancelEngineerVisit(stage.projectId, reason.trim());
      onDone("Visit cancelled. Operations and the engineer have been notified.");
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not cancel the visit. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const dateChanged = requested && date && date !== requested;
  const engineerOptions = engineers.some((e) => e.email === currentEngineer) || !currentEngineer
    ? engineers
    : [{ email: currentEngineer, fullName: currentEngineer.split("@")[0] } as UserResponse, ...engineers];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">
              {isPending ? "Approve factory visit" : "Change factory visit"}
            </h2>
            <p className="text-sm text-gray-500 truncate">{stage.projectName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="rounded-lg bg-gray-50 border px-3 py-2 text-sm text-gray-700 space-y-0.5">
            {isPending ? (
              <p>
                Requested for <b>{visitDateLabel(requested)}</b>
                {visit.requestedBy ? <> by <b>{visit.requestedBy}</b></> : null}
              </p>
            ) : (
              <p>
                Scheduled for <b>{visitDateLabel(visit.visitDate)}</b>
                {visit.approvedBy ? <> · approved by {visit.approvedBy}</> : null}
              </p>
            )}
            <p className="text-xs text-gray-500">
              Engineer: {currentEngineer ? engineerOptions.find((e) => e.email === currentEngineer)?.fullName ?? currentEngineer : "not assigned"}
            </p>
          </div>

          {!cancelMode ? (
            <>
              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Visit date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                {dateChanged && (
                  <span className="mt-1 block text-xs text-amber-700">
                    Changed from the requested {visitDateLabel(requested)} — Operations will be told.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Engineer for this visit</span>
                <select value={engineerEmail} onChange={(e) => setEngineerEmail(e.target.value)} className={inputCls}>
                  {!currentEngineer && <option value="">— Not assigned —</option>}
                  {engineerOptions.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.fullName ?? u.email}
                    </option>
                  ))}
                </select>
                {engineerEmail && engineerEmail !== currentEngineer && (
                  <span className="mt-1 block text-xs text-amber-700">
                    The project's engineer will change to this person.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                  placeholder="e.g. Train tickets booked for 11 Nov night"
                  className={inputCls}
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="block text-xs font-medium text-gray-600 mb-1">Why is the visit cancelled? *</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus
                placeholder="e.g. Client not ready — documents pending"
                className={inputCls}
              />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t">
          {!cancelMode ? (
            <>
              <button
                onClick={() => { setCancelMode(true); setError(null); }}
                className="mr-auto px-3 py-2 rounded-lg text-sm font-medium text-red-700 border border-red-200 hover:bg-red-50"
              >
                Cancel visit
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
                Close
              </button>
              <button
                onClick={approve}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : isPending ? "Approve" : "Save changes"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setCancelMode(false); setError(null); }}
                className="mr-auto px-4 py-2 rounded-lg text-sm border hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={cancelVisit}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? "Cancelling…" : "Cancel this visit"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}