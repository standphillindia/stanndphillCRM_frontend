// src/pages/admin/VisitApprovalsTab.tsx
//
// Admin Panel → Visit Approvals.
//   1. Factory visit dates requested by Operations / Engineers, waiting for
//      approval — Review opens VisitApprovalModal (approve as is, change the
//      date or engineer, or cancel).
//   2. Upcoming approved visits — to change the date / engineer or cancel
//      one after it was approved (e.g. tickets changed).
// Same actions as the box on My Tasks and the project's stages page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchEngineerVisits,
  fetchVisitApprovals,
  parseEngineerVisitState,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import { visitDateLabel } from "../../utils/visitPermissions";
import { getApiErrorMessage } from "../../utils/apiError";
import { useToastNotification } from "../../hooks/useToastNotification";
import VisitApprovalModal from "../../components/projects/VisitApprovalModal";

const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
const engineerOf = (t: StageTrackerResponse) => (t.assignedUserEmail ? t.assignedUserEmail.split("@")[0] : "—");

export default function VisitApprovalsTab() {
  const toast = useToastNotification();
  const [pending, setPending] = useState<StageTrackerResponse[]>([]);
  const [visits, setVisits] = useState<StageTrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<StageTrackerResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, all] = await Promise.all([fetchVisitApprovals(), fetchEngineerVisits()]);
      setPending(p);
      setVisits(all);
      setError(null);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load visit approvals."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchVisitApprovals(), fetchEngineerVisits()])
      .then(([p, all]) => {
        if (cancelled) return;
        setPending(p);
        setVisits(all);
      })
      .catch((e) => { if (!cancelled) setError(getApiErrorMessage(e, "Could not load visit approvals.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Approved visits from today on, soonest first.
  const upcoming = useMemo(() => {
    const today = todayIso();
    return visits
      .filter((t) => t.status !== "DONE")
      .map((t) => ({ t, v: parseEngineerVisitState(t.validationData) }))
      .filter(({ v }) => v.visitStatus === "SCHEDULED" && v.visitDate && v.visitDate >= today)
      .sort((a, b) => (a.v.visitDate ?? "").localeCompare(b.v.visitDate ?? ""));
  }, [visits]);

  if (loading) return <div className="glass-card rounded-xl p-8 text-center text-secondary">Loading visit approvals…</div>;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant/20">
          <h3 className="text-headline-md font-semibold text-on-surface">
            Waiting for approval {pending.length > 0 && <span className="text-primary">({pending.length})</span>}
          </h3>
          <p className="text-body-md text-secondary mt-1">
            Visit dates requested by Operations / Engineers. Approve the date, change the date or engineer, or cancel
            the visit. Travel is booked on the approved date.
          </p>
        </div>

        {error && <div className="px-6 py-3 text-error text-body-sm">{error}</div>}

        {pending.length === 0 ? (
          <p className="px-6 py-8 text-center text-secondary text-body-md">No visit is waiting for approval.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-outline-variant/20">
                  <th className="px-6 py-3">Project</th>
                  <th className="px-3 py-3">Requested date</th>
                  <th className="px-3 py-3">Requested by</th>
                  <th className="px-3 py-3">Engineer</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => {
                  const v = parseEngineerVisitState(t.validationData);
                  return (
                    <tr key={t.id} className="border-b border-outline-variant/10">
                      <td className="px-6 py-3">
                        <Link to={`/projects/${t.projectId}/stages`} className="font-medium text-on-surface hover:underline">
                          {t.projectName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{visitDateLabel(v.requestedDate ?? v.visitDate)}</td>
                      <td className="px-3 py-3">{v.requestedBy ?? "—"}</td>
                      <td className="px-3 py-3">{engineerOf(t)}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => setOpen(t)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-outline-variant/20">
          <h3 className="text-headline-md font-semibold text-on-surface">Upcoming approved visits</h3>
          <p className="text-body-md text-secondary mt-1">
            Scheduled factory visits from today on. Change the date or engineer, or cancel one if plans change.
          </p>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-6 py-8 text-center text-secondary text-body-md">No upcoming approved visits.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-secondary border-b border-outline-variant/20">
                  <th className="px-6 py-3">Project</th>
                  <th className="px-3 py-3">Visit date</th>
                  <th className="px-3 py-3">Engineer</th>
                  <th className="px-3 py-3">Approved by</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map(({ t, v }) => (
                  <tr key={t.id} className="border-b border-outline-variant/10">
                    <td className="px-6 py-3">
                      <Link to={`/projects/${t.projectId}/stages`} className="font-medium text-on-surface hover:underline">
                        {t.projectName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{visitDateLabel(v.visitDate)}</td>
                    <td className="px-3 py-3">{engineerOf(t)}</td>
                    <td className="px-3 py-3">{v.approvedBy ?? "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => setOpen(t)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50"
                      >
                        Change / cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <VisitApprovalModal
          stage={open}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            toast.success("Done", message);
            load();
          }}
        />
      )}
    </div>
  );
}