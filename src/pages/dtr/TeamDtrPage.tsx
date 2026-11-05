// src/pages/dtr/TeamDtrPage.tsx
//
// Team DTR (Admin / HR) — everyone's Daily Task Report for a day: who has
// submitted, who is on draft, who hasn't filled it. Open a person's DTR,
// leave a comment, re-open a locked day, send a reminder, and download
// Excel in the same columns as the team's Google Sheet.

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, MessageSquare, Search, Unlock, Users, X } from "lucide-react";
import {
  DTR_STATUS_STYLE,
  commentOnDtr,
  exportTeamDtr,
  getPersonDtr,
  getTeamDtr,
  prettyDateTime,
  prettyDtrDate,
  prettyTime,
  remindTeam,
  todayIst,
  unlockDtr,
  type DtrDay,
  type TeamDtr,
  type TeamDtrRow,
} from "../../services/dtrService";
import { USER_DEPARTMENTS } from "../../constants/userConstants";

const ROW_STATUS: Record<string, string> = {
  SUBMITTED: "bg-green-100 text-green-800",
  DRAFT: "bg-amber-100 text-amber-800",
  NOT_FILLED: "bg-red-100 text-red-700",
};
const ROW_LABEL: Record<string, string> = { SUBMITTED: "Submitted", DRAFT: "Draft", NOT_FILLED: "Not filled" };
const ITEM_LABEL: Record<string, string> = { COMPLETED: "Completed", IN_PROGRESS: "In Progress", PENDING: "Pending" };

export default function TeamDtrPage() {
  const [date, setDate] = useState(todayIst());
  const [department, setDepartment] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<TeamDtr | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [open, setOpen] = useState<DtrDay | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const [exportFrom, setExportFrom] = useState(todayIst());
  const [exportTo, setExportTo] = useState(todayIst());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTeamDtr(date, department));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Team DTR");
    } finally {
      setLoading(false);
    }
  }, [date, department]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (data?.rows ?? []).filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || (r.department ?? "").toLowerCase().includes(q);
  });
  const notFilled = (data?.rows ?? []).filter((r) => r.status === "NOT_FILLED");

  const openPerson = async (r: TeamDtrRow) => {
    setError(null);
    try {
      const d = await getPersonDtr(r.userId, date);
      setOpen(d);
      setComment(d.reviewComment ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that DTR");
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };

  const downloadExcel = () =>
    run(async () => {
      const list = await exportTeamDtr(exportFrom, exportTo, department);
      if (list.length === 0) {
        setNotice("No DTR rows in that date range.");
        return;
      }
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("DTR");
      ws.columns = [
        { header: "Date", key: "date", width: 12 },
        { header: "Day", key: "day", width: 11 },
        { header: "Name", key: "name", width: 22 },
        { header: "Department", key: "department", width: 14 },
        { header: "Task Assigned / Planned", key: "task", width: 50 },
        { header: "Status", key: "status", width: 13 },
        { header: "Pending Work with Reason", key: "pendingReason", width: 40 },
        { header: "Remarks", key: "remarks", width: 40 },
      ];
      ws.getRow(1).font = { bold: true };
      list.forEach((r) => ws.addRow({ ...r, date: r.date.split("-").reverse().join("-") }));
      ws.eachRow((row) => (row.alignment = { vertical: "top", wrapText: true }));
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `DTR_${exportFrom}_to_${exportTo}${department ? "_" + department : ""}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    });

  return (
    <div className="p-0 lg:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Team DTR</h1>
      <p className="text-sm text-gray-500 mb-4">Everyone's Daily Task Report for the day.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input type="date" value={date} max={todayIst()} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
        <select value={department} onChange={(e) => setDepartment(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
          <option value="">Department: All</option>
          {USER_DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search person…"
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm" />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">⚠️ {error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm mb-4">✓ {notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {([
          ["Team", data?.team ?? 0, "text-gray-900", <Users key="i" size={15} />],
          ["Submitted", data?.submitted ?? 0, "text-green-700", <CheckCircle2 key="i" size={15} />],
          ["Draft", data?.draft ?? 0, "text-amber-700", <AlertCircle key="i" size={15} />],
          ["Not filled", data?.notFilled ?? 0, "text-red-600", <AlertCircle key="i" size={15} />],
        ] as const).map(([label, value, cls, icon]) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs uppercase text-gray-500 flex items-center gap-1.5">{icon}{label}</div>
            <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {date === todayIst() && notFilled.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-800 flex flex-wrap items-center justify-between gap-2">
          <span><b>Not filled yet:</b> {notFilled.map((r) => r.name).join(", ")}</span>
          <button disabled={busy} onClick={() => run(async () => {
            const n = await remindTeam(department);
            setNotice(`Reminder sent to ${n} ${n === 1 ? "person" : "people"}.`);
          })} className="text-xs font-semibold underline disabled:opacity-50">Send reminder</button>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="lg:hidden divide-y">
            {rows.map((r) => (
              <button key={r.userId} onClick={() => openPerson(r)} className="w-full text-left p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.department ?? r.role ?? "—"}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${ROW_STATUS[r.status]}`}>{ROW_LABEL[r.status]}</span>
                </div>
                {r.tasks > 0 && (
                  <div className="mt-1 text-xs text-gray-600">{r.tasks} tasks · {r.completed} completed · {r.pending} pending</div>
                )}
              </button>
            ))}
          </div>
          <table className="hidden lg:table w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2.5 text-left">Person</th>
                <th className="px-4 py-2.5 text-left">Status</th>
                <th className="px-4 py-2.5 text-left">Submitted at</th>
                <th className="px-4 py-2.5 text-center">Tasks</th>
                <th className="px-4 py-2.5 text-center">Completed</th>
                <th className="px-4 py-2.5 text-center">Pending</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No one to show.</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="text-xs text-gray-500">{r.department ?? r.role ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${ROW_STATUS[r.status]}`}>{ROW_LABEL[r.status]}</span></td>
                  <td className="px-4 py-3 text-gray-600">{prettyTime(r.submittedAt)}</td>
                  <td className="px-4 py-3 text-center">{r.tasks || "—"}</td>
                  <td className="px-4 py-3 text-center text-green-700 font-medium">{r.tasks ? r.completed : "—"}</td>
                  <td className="px-4 py-3 text-center text-amber-700 font-medium">{r.tasks ? r.pending : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openPerson(r)} className="text-indigo-700 font-semibold text-sm">View →</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Excel — same columns as the team's Google Sheet */}
      <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={exportFrom} max={todayIst()} onChange={(e) => setExportFrom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={exportTo} max={todayIst()} onChange={(e) => setExportTo(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <button disabled={busy} onClick={downloadExcel}
          className="flex items-center gap-1.5 px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          <Download size={15} /> Download Excel
        </button>
        <span className="text-xs text-gray-500">Up to 3 months · follows the Department filter</span>
      </div>

      {/* One person's DTR */}
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between px-5 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{open.userName}</h2>
                <p className="text-xs text-gray-500">
                  {open.department ?? open.role} · {prettyDtrDate(open.date)} ·{" "}
                  {open.status === "SUBMITTED" ? `Submitted ${prettyDateTime(open.submittedAt)}` : open.status === "DRAFT" ? "Draft" : "Not filled"}
                </p>
              </div>
              <button onClick={() => setOpen(null)} className="p-1 rounded hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto space-y-3">
              {open.items.length === 0 ? (
                <p className="text-sm text-gray-500">No tasks written for this day.</p>
              ) : (
                <div className="space-y-2">
                  {open.items.map((i, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 whitespace-pre-line">{i.task}</span>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${DTR_STATUS_STYLE[i.status]}`}>{ITEM_LABEL[i.status] ?? i.status}</span>
                      </div>
                      {i.pendingReason && <div className="mt-1 text-xs text-amber-800 bg-amber-50 rounded px-2 py-1">Pending: {i.pendingReason}</div>}
                      {i.remarks && <div className="mt-1 text-xs text-gray-600">Remarks: {i.remarks}</div>}
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1"><MessageSquare size={15} /> Comment for {open.userName}</label>
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. Finish this by Wednesday" />
              </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 px-5 py-3 border-t bg-gray-50 rounded-b-xl">
              {!open.editable ? (
                <button disabled={busy} onClick={() => run(async () => {
                  setOpen(await unlockDtr(open.userId, open.date));
                  setNotice(`${open.userName}'s DTR re-opened for 24 hours.`);
                })} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white rounded-lg text-sm font-medium disabled:opacity-50">
                  <Unlock size={15} /> Re-open for 24 h
                </button>
              ) : <span />}
              <button disabled={busy} onClick={() => run(async () => {
                setOpen(await commentOnDtr(open.userId, open.date, comment));
                setNotice("Comment saved.");
              })} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                Save comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}