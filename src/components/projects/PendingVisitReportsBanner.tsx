// src/components/projects/PendingVisitReportsBanner.tsx
//
// "Factory visit paperwork pending" — visits the engineer logged in the
// last 30 days whose document checklist or basic information form is not
// filled yet (e.g. the page was closed right after "Log Visit Result").
// Shown on My Tasks and Visit Expenses so the engineer can come back to it
// without opening the Projects module. Renders nothing when all are done.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPendingVisitReports, type PendingVisitReport } from "../../services/visitReportService";

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" })
    : "";

export default function PendingVisitReportsBanner({ showEngineer = false }: { showEngineer?: boolean }) {
  const [items, setItems] = useState<PendingVisitReport[]>([]);

  useEffect(() => {
    let cancelled = false;
    getPendingVisitReports()
      .then((list) => { if (!cancelled) setItems(list); })
      .catch(() => { /* reminder only — the page works without it */ });
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-semibold text-amber-900">
        📋 Factory visit basic info & checklist pending ({items.length})
      </p>
      <p className="text-xs text-amber-800 mb-2">
        Fill the basic information form and document checklist for these visits.
      </p>
      <ul className="divide-y divide-amber-200">
        {items.map((v) => (
          <li key={v.projectId} className="py-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="flex-1 min-w-0">
              <span className="font-medium text-gray-900">{v.projectName}</span>
              <span className="block text-xs text-gray-600">
                Visit logged {when(v.visitLoggedAt)}
                {showEngineer && v.engineerName ? ` · ${v.engineerName}` : ""}
                {" · "}
                {v.basicInfoDone ? "Basic info done, checklist pending"
                  : v.checklistDone ? "Checklist done, basic info pending"
                  : "Basic info and checklist pending"}
              </span>
            </span>
            <Link
              to={`/visit-report/${v.projectId}`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-amber-600 hover:bg-amber-700"
            >
              {v.basicInfoDone ? "Fill checklist" : v.checklistDone ? "Fill basic info" : "Fill now"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}