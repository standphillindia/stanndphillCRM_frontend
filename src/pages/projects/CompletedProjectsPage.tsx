// src/pages/projects/CompletedProjectsPage.tsx
//
// Completed Projects — every project that has finished (licence granted or
// all stages done), newest first, with month-wise counts.
//
// Digital Marketing uses it to put new licences on the website; everyone
// else uses it as the record of how many projects closed each month.
// Open to every signed-in user — it carries no amounts.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchCompletedProjects,
  type CompletedProjectRow,
  type CompletedProjectsResponse,
} from "../../services/completedProjectsService";
import ClampText from "../../components/common/ClampText";

type Period = "ALL" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "CUSTOM";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "2026-10-14" → "14 Oct 2026" */
const prettyDate = (s: string | null | undefined) => {
  if (!s) return "—";
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "2026-10" → "Oct 2026" */
const prettyMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};

const monthRange = (ym: string): { from: string; to: string } => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
};

function rangeFor(period: Period, custom: { from: string; to: string }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  switch (period) {
    case "THIS_MONTH":
      return monthRange(`${y}-${pad(m + 1)}`);
    case "LAST_MONTH": {
      const d = new Date(y, m - 1, 1);
      return monthRange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    }
    case "THIS_YEAR":
      return { from: `${y}-01-01`, to: iso(now) };
    case "CUSTOM":
      return custom;
    default:
      return { from: "", to: "" };
  }
}

const statusLabel = (s: CompletedProjectRow["status"]) =>
  s === "LICENSE_GRANTED" ? "Licence granted" : "Closed";

// ── Excel (CSV) download ─────────────────────────────────────────────────
function downloadCsv(rows: CompletedProjectRow[], label: string) {
  const header = [
    "Completed On", "Company", "Project", "Product", "Certification", "Certificate No.",
    "Licence Issue Date", "Licence Expiry", "Contact Person", "City", "State",
    "Engineer", "Ops Person", "Status",
  ];
  const cell = (v: string | null | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      prettyDate(r.completedOn), r.companyName, r.projectName, r.product, r.certificationType,
      r.certificateNo, prettyDate(r.licenseIssueDate), prettyDate(r.licenseExpiryDate),
      r.contactName, r.city, r.state, r.engineerName, r.opsPersonName, statusLabel(r.status),
    ].map((v) => cell(v === "—" ? "" : v)).join(",")
  );
  // BOM so Excel opens the file as UTF-8 (keeps "—", "₹" etc. intact).
  const blob = new Blob(["﻿" + [header.map(cell).join(","), ...lines].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `completed-projects-${label}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function CompletedProjectsPage() {
  const [data, setData] = useState<CompletedProjectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>("ALL");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [search, setSearch] = useState("");

  const range = useMemo(() => rangeFor(period, custom), [period, custom]);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setData(await fetchCompletedProjects({ from: range.from, to: range.to, search }));
      } catch (e) {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        setError(err?.response?.data?.message ?? err?.message ?? "Could not load completed projects.");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [range.from, range.to, search]);

  const now = new Date();
  const thisMonthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthLabel = `${MONTHS[lastMonthDate.getMonth()]} ${lastMonthDate.getFullYear()}`;

  const maxMonth = Math.max(1, ...(data?.lastTwelveMonths.map((m) => m.count) ?? [0]));

  const selectMonth = (ym: string) => {
    setCustom(monthRange(ym));
    setPeriod("CUSTOM");
  };

  const rows = data?.rows ?? [];
  const periodText =
    period === "ALL" ? "All time"
      : period === "CUSTOM"
        ? `${prettyDate(range.from || null)} – ${prettyDate(range.to || null)}`
        : { THIS_MONTH: thisMonthLabel, LAST_MONTH: lastMonthLabel, THIS_YEAR: String(now.getFullYear()) }[period];

  return (
    <div className="p-0 lg:p-6">
      <div className="mb-4 lg:mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Completed Projects</h1>
          <p className="text-gray-500">Projects that are finished — licence granted or all stages done.</p>
        </div>
        <button
          disabled={rows.length === 0}
          onClick={() => downloadCsv(rows, iso(new Date()))}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40"
          title="Downloads the rows shown below — opens in Excel"
        >
          ⬇ Download Excel
        </button>
      </div>

      {/* ── Counts ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: `This month · ${thisMonthLabel}`, value: data?.thisMonth, onClick: () => setPeriod("THIS_MONTH") },
          { label: `Last month · ${lastMonthLabel}`, value: data?.lastMonth, onClick: () => setPeriod("LAST_MONTH") },
          { label: `This year · ${now.getFullYear()}`, value: data?.thisYear, onClick: () => setPeriod("THIS_YEAR") },
          { label: "Total completed", value: data?.total, onClick: () => setPeriod("ALL") },
        ].map((c) => (
          <button
            key={c.label}
            onClick={c.onClick}
            className="text-left rounded-lg border bg-white p-4 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
          >
            <div className="text-xs text-gray-500">{c.label}</div>
            <div className="text-2xl lg:text-3xl font-bold mt-1">{c.value ?? "—"}</div>
          </button>
        ))}
      </div>

      {/* ── Month by month ─────────────────────────────────────────── */}
      {data && (
        <div className="rounded-lg border bg-white p-4 mb-6">
          <div className="text-sm font-semibold text-gray-700 mb-3">Completed per month — last 12 months</div>
          <div className="flex items-end gap-2 h-36">
            {data.lastTwelveMonths.map((m) => {
              const active = period === "CUSTOM" && range.from === monthRange(m.month).from && range.to === monthRange(m.month).to;
              return (
                <button
                  key={m.month}
                  onClick={() => selectMonth(m.month)}
                  className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group"
                  title={`${prettyMonth(m.month)}: ${m.count} completed`}
                >
                  <span className="text-xs font-medium text-gray-700 mb-1">{m.count}</span>
                  <div
                    className={`w-full max-w-[36px] rounded-t ${active ? "bg-blue-600" : "bg-blue-300 group-hover:bg-blue-400"}`}
                    style={{ height: `${Math.max(m.count === 0 ? 2 : 8, (m.count / maxMonth) * 100)}%` }}
                  />
                  <span className="text-[11px] text-gray-500 mt-1 truncate w-full text-center">
                    {prettyMonth(m.month).replace(" 20", " '")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">Click a month to see its projects.</p>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="px-3 py-2 rounded-lg border text-sm bg-white"
          >
            <option value="ALL">All time</option>
            <option value="THIS_MONTH">This month</option>
            <option value="LAST_MONTH">Last month</option>
            <option value="THIS_YEAR">This year</option>
            <option value="CUSTOM">Custom dates</option>
          </select>
        </div>
        {period === "CUSTOM" && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="px-3 py-2 rounded-lg border text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="px-3 py-2 rounded-lg border text-sm"
              />
            </div>
          </>
        )}
        <div className="flex-1 min-w-full sm:min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Company, project, product or certificate no."
            className="w-full px-3 py-2 rounded-lg border text-sm"
          />
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-2">
        {loading ? "Loading…" : `${rows.length} project${rows.length === 1 ? "" : "s"} · ${periodText}`}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* ── Phone: one card per project (the table below is for laptops) ── */}
      <div className="lg:hidden space-y-2.5">
        {rows.map((r) => (
          <div key={r.projectId} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-gray-900 break-words">{r.companyName ?? "—"}</span>
              <span
                className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                  r.status === "LICENSE_GRANTED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                }`}
              >
                {statusLabel(r.status)}
              </span>
            </div>
            <Link to={`/projects/${r.projectId}/stages`} className="mt-0.5 block text-sm text-blue-700 break-words">
              {r.projectName}
            </Link>
            {r.product && <ClampText text={r.product} className="text-xs text-gray-500" />}
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
              <span>✅ Completed {prettyDate(r.completedOn)}</span>
              <span>{r.certificationType ?? "—"}</span>
              <span>📄 {r.certificateNo ?? "No certificate no."}</span>
              <span>📅 Licence {prettyDate(r.licenseIssueDate)}</span>
              <span>📍 {[r.city, r.state].filter(Boolean).join(", ") || "—"}</span>
              <span>👷 {r.engineerName ?? "—"}</span>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="rounded-xl border bg-white p-6 text-center text-gray-400 text-sm">No completed projects for this period.</p>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="hidden lg:block overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <th className="p-3 text-left whitespace-nowrap">Completed On</th>
              <th className="p-3 text-left">Company</th>
              <th className="p-3 text-left">Project / Product</th>
              <th className="p-3 text-left">Certification</th>
              <th className="p-3 text-left whitespace-nowrap">Certificate No.</th>
              <th className="p-3 text-left whitespace-nowrap">Licence Date</th>
              <th className="p-3 text-left">Location</th>
              <th className="p-3 text-left">Engineer</th>
              <th className="p-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.projectId} className="border-b hover:bg-gray-50 align-top">
                <td className="p-3 whitespace-nowrap">{prettyDate(r.completedOn)}</td>
                <td className="p-3 font-medium min-w-[180px]">{r.companyName ?? "—"}</td>
                <td className="p-3 min-w-[220px]">
                  <Link to={`/projects/${r.projectId}/stages`} className="text-blue-700 hover:underline">
                    {r.projectName}
                  </Link>
                  {r.product && <ClampText text={r.product} className="text-xs text-gray-500" />}
                </td>
                <td className="p-3">{r.certificationType ?? "—"}</td>
                <td className="p-3">{r.certificateNo ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{prettyDate(r.licenseIssueDate)}</td>
                <td className="p-3">{[r.city, r.state].filter(Boolean).join(", ") || "—"}</td>
                <td className="p-3">{r.engineerName ?? "—"}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      r.status === "LICENSE_GRANTED" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-400">
                  No completed projects for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}