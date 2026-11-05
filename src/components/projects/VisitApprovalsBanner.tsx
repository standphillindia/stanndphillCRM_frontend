// src/components/projects/VisitApprovalsBanner.tsx
//
// Admin: factory visit dates requested by Operations / Engineers that are
// waiting for approval. Each row opens VisitApprovalModal (approve as is,
// change the date or engineer, or cancel). Renders nothing when none wait.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchVisitApprovals,
  parseEngineerVisitState,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import { visitDateLabel } from "../../utils/visitPermissions";
import VisitApprovalModal from "./VisitApprovalModal";

interface Props {
  /** Called after an approval / cancellation, e.g. to reload the page's tasks. */
  onChanged?: (message: string) => void;
}

export default function VisitApprovalsBanner({ onChanged }: Props) {
  const [items, setItems] = useState<StageTrackerResponse[]>([]);
  const [open, setOpen] = useState<StageTrackerResponse | null>(null);

  const refresh = useCallback(() => {
    fetchVisitApprovals()
      .then(setItems)
      .catch(() => { /* reminder only — the page works without it */ });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchVisitApprovals()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { /* reminder only */ });
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0 && !open) return null;

  return (
    <>
      {items.length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
          <p className="text-sm font-semibold text-blue-900">
            🗓️ Factory visits waiting for your approval ({items.length})
          </p>
          <p className="text-xs text-blue-800 mb-2">
            Approve the requested date, change the date or engineer, or cancel the visit. Travel is booked on the approved date.
          </p>
          <ul className="divide-y divide-blue-200">
            {items.map((t) => {
              const v = parseEngineerVisitState(t.validationData);
              return (
                <li key={t.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="flex-1 min-w-0">
                    <Link to={`/projects/${t.projectId}/stages`} className="font-medium text-gray-900 hover:underline">
                      {t.projectName}
                    </Link>
                    <span className="block text-xs text-gray-600">
                      Requested for {visitDateLabel(v.requestedDate ?? v.visitDate)}
                      {v.requestedBy ? ` by ${v.requestedBy}` : ""}
                      {t.assignedUserEmail ? ` · Engineer: ${t.assignedUserEmail.split("@")[0]}` : " · No engineer assigned"}
                    </span>
                  </span>
                  <button
                    onClick={() => setOpen(t)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Review
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {open && (
        <VisitApprovalModal
          stage={open}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            refresh();
            onChanged?.(message);
          }}
        />
      )}
    </>
  );
}