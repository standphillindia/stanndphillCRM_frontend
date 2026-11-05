// src/components/leads/FollowUpPanel.tsx
//
// The call list that sits above the Leads table: every lead whose follow-up
// is due today or overdue, oldest first.
//
// Follow-up is a date a lead carries at any stage from Contacted to PI
// Raised — no longer a status of its own. So each row shows the lead's real
// status beside the date, plus the remark left when the follow-up was set,
// so whoever picks up the phone knows where the deal stands and what was
// said last time.
//
// Editing happens in the Leads page's follow-up popup (onEditFollowUp), not
// inline here. The old inline date picker had no room for a remark, and the
// backend now requires one whenever a date is set.
//
// Fed by its own endpoint rather than the table's data: the Leads table is
// paginated, so a panel built from it would quietly miss anyone due on
// page 2.

import { useEffect, useMemo, useState } from "react";
import { fetchFollowUpLeads, type LeadResponse } from "../../services/leadService";

interface Props {
  /** Opens the follow-up popup for this lead (date + remark). */
  onEditFollowUp?: (lead: LeadResponse) => void;
  /**
   * Admin's "Assigned to" filter from the Leads page, so the call list and
   * the table always show the same person's work. Ignored by the backend
   * for anyone who isn't an admin.
   */
  assignedToEmail?: string;
  /** Bump to reload — the parent does this after a follow-up is saved. */
  refreshKey?: number;
}

const STATUS_STYLES: Record<string, string> = {
  CONTACTED: "bg-sky-100 text-sky-800",
  FOLLOW_UP: "bg-orange-100 text-orange-800",
  QUALIFIED: "bg-indigo-100 text-indigo-800",
  PROPOSAL: "bg-violet-100 text-violet-800",
  NEGOTIATION: "bg-purple-100 text-purple-800",
  PI_RAISED: "bg-amber-100 text-amber-900",
};

const todayIso = () => new Date().toISOString().split("T")[0];

const daysBetween = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(todayIso() + "T00:00:00");
  return Math.round((t.getTime() - d.getTime()) / 86_400_000);
};

const formatDate = (iso?: string | null) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      })
    : "—";

export default function FollowUpPanel({ onEditFollowUp, assignedToEmail, refreshKey }: Props) {
  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchFollowUpLeads(assignedToEmail || undefined)
      .then((rows) => {
        if (cancelled) return;
        setLeads(rows);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load follow-ups");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    // A quick filter change can finish out of order; the flag stops an
    // older response overwriting the newer one.
    return () => {
      cancelled = true;
    };
  }, [assignedToEmail, refreshKey]);

  const { overdue, dueToday } = useMemo(() => {
    const t = todayIso();
    return {
      overdue: leads.filter((l) => l.nextFollowUpDate && l.nextFollowUpDate < t),
      dueToday: leads.filter((l) => l.nextFollowUpDate === t),
    };
  }, [leads]);

  // Nothing due is a good outcome, not an empty state to apologise for.
  if (!loading && leads.length === 0 && !error) {
    return (
      <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-body-sm text-green-800">
        ✅ No follow-ups due today. Everything's on schedule.
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-amber-50 transition"
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-amber-700">
            phone_in_talk
          </span>
          <span className="font-semibold text-gray-900">Follow-ups to call</span>
          {overdue.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
              {overdue.length} overdue
            </span>
          )}
          {dueToday.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-semibold">
              {dueToday.length} today
            </span>
          )}
        </div>
        <span className="material-symbols-outlined text-[20px] text-gray-500">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-body-sm">
          ⚠️ {error}
        </div>
      )}

      {open && (
        <div className="border-t border-amber-200 bg-white">
          {loading && (
            <div className="px-4 py-6 text-center text-gray-500 text-body-sm">Loading…</div>
          )}

          {!loading &&
            leads.map((lead) => {
              const late = lead.nextFollowUpDate ? daysBetween(lead.nextFollowUpDate) : 0;

              return (
                <div
                  key={lead.id}
                  className="flex flex-wrap items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">
                        {lead.companyName || lead.contactName || "—"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                          STATUS_STYLES[lead.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {lead.status?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {lead.contactName && lead.companyName ? `${lead.contactName} · ` : ""}
                      {lead.phone || "no phone"}
                      {lead.assignedToEmail && lead.assignedToEmail !== "Unassigned"
                        ? ` · ${lead.assignedToEmail.split("@")[0]}`
                        : ""}
                    </div>
                    {/* The reason for the call — the point of this whole panel.
                        Without it the caller rings in cold. */}
                    {lead.followUpRemark && (
                      <div className="mt-1 text-body-sm text-gray-700 italic">
                        “{lead.followUpRemark}”
                      </div>
                    )}
                  </div>

                  <div className="min-w-[130px] text-body-sm pt-0.5">
                    <span className="text-gray-500">Due </span>
                    <span className="font-medium">{formatDate(lead.nextFollowUpDate)}</span>
                    {late > 0 && (
                      <span className="ml-2 text-red-600 font-semibold text-xs">{late}d late</span>
                    )}
                    {late === 0 && (
                      <span className="ml-2 text-amber-700 font-semibold text-xs">today</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                      >
                        Call
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onEditFollowUp?.(lead)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                      Update
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}