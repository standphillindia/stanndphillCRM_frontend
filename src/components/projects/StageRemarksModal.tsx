// src/components/projects/StageRemarksModal.tsx
//
// Notes on one project stage — "Report not received yet, lab waiting for
// sample", "Application not submitted, client documents pending".
// Shows the stage's full note history (newest first) and lets anyone add
// a new note. Notes are never edited or deleted.
//
// requireLateReason: opened from "Mark Done" on a late stage that has no
// delay note yet. The header asks why it is late, and after the note is
// saved onSaved() lets the page carry on with marking it done.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  addStageRemark,
  fetchProjectRemarks,
  type StageRemark,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import { getApiErrorMessage } from "../../utils/apiError";

interface Props {
  stage: StageTrackerResponse;
  requireLateReason?: boolean;
  onClose: () => void;
  /** Called after a note is saved. */
  onSaved: (remark: StageRemark) => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

export default function StageRemarksModal({ stage, requireLateReason = false, onClose, onSaved }: Props) {
  const [remarks, setRemarks] = useState<StageRemark[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProjectRemarks(stage.projectId)
      .then((all) => { if (!cancelled) setRemarks(all.filter((r) => r.stageCode === stage.stageCode)); })
      .catch((e) => { if (!cancelled) setLoadError(getApiErrorMessage(e, "Could not load notes.")); });
    return () => { cancelled = true; };
  }, [stage.projectId, stage.stageCode]);

  const daysLate =
    stage.daysLateOrRemaining !== null && stage.daysLateOrRemaining < 0 ? Math.abs(stage.daysLateOrRemaining) : null;

  const save = async () => {
    const clean = text.trim();
    if (!clean) return setError(requireLateReason ? "Write why this stage is late." : "Write the note first.");
    setSaving(true);
    setError(null);
    try {
      const saved = await addStageRemark(stage.projectId, stage.stageCode, clean);
      setRemarks((prev) => [saved, ...(prev ?? [])]);
      setText("");
      onSaved(saved);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save the note. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">
              {requireLateReason ? "Why is this stage late?" : "Stage notes"}
            </h2>
            <p className="text-sm text-gray-500 truncate">
              {stage.displayName} · {stage.projectName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {requireLateReason && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            This stage is {daysLate ? `${daysLate} day(s) ` : ""}past its due date
            {stage.dueDate ? ` (${stage.dueDate})` : ""}. Write the reason for the delay — it is saved in the
            stage's notes — then it will be marked done.
          </div>
        )}

        <div className="px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            autoFocus
            placeholder={
              requireLateReason
                ? "e.g. Lab report not received yet — sample rejected, re-sent on 15 Oct"
                : "e.g. Application not submitted — client documents pending"
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !text.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                requireLateReason ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {saving ? "Saving…" : requireLateReason ? "Save reason & mark done" : "Add note"}
            </button>
          </div>
        </div>

        <div className="border-t px-5 py-3 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            History{remarks ? ` (${remarks.length})` : ""}
          </p>
          {loadError && <p className="text-sm text-red-600">{loadError}</p>}
          {!remarks && !loadError && <p className="text-sm text-gray-400">Loading…</p>}
          {remarks && remarks.length === 0 && <p className="text-sm text-gray-400">No notes on this stage yet.</p>}
          <ul className="space-y-3">
            {remarks?.map((r) => (
              <li key={r.id} className="text-sm">
                <p className="whitespace-pre-line text-gray-800">{r.text}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.authorName ?? r.authorEmail ?? "Someone"} · {when(r.createdAt)}
                  {r.writtenWhileLate && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      Delay reason
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
}