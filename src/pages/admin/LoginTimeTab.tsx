// src/pages/admin/LoginTimeTab.tsx
//
// Admin Panel → Login Time. How long each person was in the CRM, per day.
//   Active      = CRM tab was on their screen.
//   CRM open    = CRM was open in their browser (also counts a background tab).
//   First / Last = first time and last time the CRM was used that day.
// Gaps longer than 5 minutes (CRM closed, laptop asleep) are not counted.
// Data starts from the day this feature went live.

import { Fragment, useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import { getApiErrorMessage } from "../../utils/apiError";

interface LoginTimeRow {
  userId: string;
  fullName: string;
  email: string | null;
  roleName: string | null;
  day: string;            // yyyy-MM-dd
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  openMinutes: number;
  activeMinutes: number;
  logins: number;
}

type Preset = "today" | "yesterday" | "7d" | "month" | "custom";

const istDate = (offsetDays = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(Date.now() + offsetDays * 86_400_000)
  );

const monthStart = () => istDate().slice(0, 8) + "01";

const hm = (minutes: number) => {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
};

const clock = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "—";

const dayLabel = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

export default function LoginTimeTab() {
  const [preset, setPreset] = useState<Preset>("today");
  const [from, setFrom] = useState(istDate());
  const [to, setTo] = useState(istDate());
  const [rows, setRows] = useState<LoginTimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);

  const choose = (p: Preset) => {
    setPreset(p);
    if (p === "today") { setFrom(istDate()); setTo(istDate()); }
    if (p === "yesterday") { setFrom(istDate(-1)); setTo(istDate(-1)); }
    if (p === "7d") { setFrom(istDate(-6)); setTo(istDate()); }
    if (p === "month") { setFrom(monthStart()); setTo(istDate()); }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get<LoginTimeRow[]>("/admin/login-time", { params: { from, to } })
      .then((res) => { if (!cancelled) { setRows(res.data); setError(null); } })
      .catch((e) => { if (!cancelled) setError(getApiErrorMessage(e, "Could not load login time.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const singleDay = from === to;

  // One line per person for the chosen dates.
  const people = useMemo(() => {
    const map = new Map<string, {
      userId: string; fullName: string; email: string | null; roleName: string | null;
      days: LoginTimeRow[]; active: number; open: number; logins: number;
    }>();
    rows.forEach((r) => {
      const p = map.get(r.userId) ?? {
        userId: r.userId, fullName: r.fullName, email: r.email, roleName: r.roleName,
        days: [], active: 0, open: 0, logins: 0,
      };
      p.days.push(r);
      p.active += r.activeMinutes;
      p.open += r.openMinutes;
      p.logins += r.logins;
      map.set(r.userId, p);
    });
    return Array.from(map.values()).sort((a, b) => b.active - a.active);
  }, [rows]);

  const downloadCsv = () => {
    const head = ["Date", "Name", "Email", "Role", "First seen", "Last seen", "Active (min)", "CRM open (min)", "Logins"];
    const lines = rows.map((r) =>
      [r.day, r.fullName, r.email ?? "", r.roleName ?? "", clock(r.firstSeenAt), clock(r.lastSeenAt),
       r.activeMinutes, r.openMinutes, r.logins]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `login-time_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => choose(p)}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
        preset === p ? "bg-blue-700 text-white border-blue-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-900">Login time</h4>
          <p className="text-sm text-gray-500">
            How long each person was in the CRM. <b>Active</b> = CRM on their screen; <b>CRM open</b> = open in the
            browser, even in the background. Breaks over 5 minutes are not counted.
          </p>
        </div>
        <button
          onClick={downloadCsv}
          disabled={rows.length === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
        >
          Download CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {presetBtn("today", "Today")}
        {presetBtn("yesterday", "Yesterday")}
        {presetBtn("7d", "Last 7 days")}
        {presetBtn("month", "This month")}
        <span className="text-sm text-gray-400 mx-1">or</span>
        <input
          type="date" value={from} max={to}
          onChange={(e) => { setPreset("custom"); setFrom(e.target.value); }}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="date" value={to} min={from} max={istDate()}
          onChange={(e) => { setPreset("custom"); setTo(e.target.value); }}
          className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <th className="p-3 text-left">Person</th>
              {singleDay ? (
                <>
                  <th className="p-3 text-left">First seen</th>
                  <th className="p-3 text-left">Last seen</th>
                </>
              ) : (
                <th className="p-3 text-left">Days in CRM</th>
              )}
              <th className="p-3 text-left">Active</th>
              <th className="p-3 text-left">CRM open</th>
              <th className="p-3 text-left">Logins</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : people.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-500">No one used the CRM on these dates.</td></tr>
            ) : (
              people.map((p) => {
                const d = p.days[0];
                const expanded = openUser === p.userId && !singleDay;
                return (
                  <Fragment key={p.userId}>
                    <tr
                      onClick={() => !singleDay && setOpenUser(expanded ? null : p.userId)}
                      className={`border-b ${singleDay ? "" : "cursor-pointer hover:bg-gray-50"}`}
                    >
                      <td className="p-3">
                        <p className="font-medium text-gray-900">{p.fullName}</p>
                        <p className="text-xs text-gray-500">{p.roleName ?? ""}{p.email ? ` · ${p.email}` : ""}</p>
                      </td>
                      {singleDay ? (
                        <>
                          <td className="p-3">{clock(d.firstSeenAt)}</td>
                          <td className="p-3">{clock(d.lastSeenAt)}</td>
                        </>
                      ) : (
                        <td className="p-3">
                          {p.days.length} {p.days.length === 1 ? "day" : "days"}
                          <span className="ml-2 text-xs text-blue-700">{expanded ? "hide" : "see days"}</span>
                        </td>
                      )}
                      <td className="p-3 font-semibold text-gray-900">
                        {hm(p.active)}
                        {!singleDay && p.days.length > 1 && (
                          <span className="block text-xs font-normal text-gray-500">
                            avg {hm(Math.round(p.active / p.days.length))}/day
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-700">{hm(p.open)}</td>
                      <td className="p-3 text-gray-700">{p.logins}</td>
                    </tr>
                    {expanded &&
                      p.days.map((r) => (
                        <tr key={`${p.userId}-${r.day}`} className="border-b bg-gray-50/60 text-gray-700">
                          <td className="p-2 pl-8 text-xs">{dayLabel(r.day)}</td>
                          <td className="p-2 text-xs">{clock(r.firstSeenAt)} – {clock(r.lastSeenAt)}</td>
                          <td className="p-2 text-xs font-semibold">{hm(r.activeMinutes)}</td>
                          <td className="p-2 text-xs">{hm(r.openMinutes)}</td>
                          <td className="p-2 text-xs">{r.logins}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}