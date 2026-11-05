// src/pages/dtr/MyDtrPage.tsx
//
// My DTR — the person's own Daily Task Report for one day.
//
// Same columns as the team's Google Sheet. "From your work in the CRM"
// lists only what this person did in the CRM on THIS date; nothing is
// added until they click Add, and an added suggestion isn't shown again.
// Today's DTR can be changed until 10 AM tomorrow; older days only if
// Admin re-opens them.

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Lock, Plus, Sparkles, Trash2, MessageSquare } from "lucide-react";
import {
  DTR_STATUS_OPTIONS,
  DTR_STATUS_STYLE,
  getMyDtr,
  getMySuggestions,
  prettyDateTime,
  prettyDtrDate,
  saveMyDtr,
  todayIst,
  type DtrDay,
  type DtrItem,
  type DtrItemStatus,
  type DtrSuggestion,
} from "../../services/dtrService";

interface Row extends DtrItem {
  _key: string;
}

let keySeq = 0;
const newKey = () => `r${Date.now()}-${keySeq++}`;
const toRows = (items: DtrItem[]): Row[] => items.map((i) => ({ ...i, _key: newKey() }));

const DAY_STATUS: Record<string, { text: string; cls: string }> = {
  NOT_STARTED: { text: "Not started", cls: "bg-gray-100 text-gray-700" },
  DRAFT: { text: "Draft — not submitted", cls: "bg-amber-100 text-amber-800" },
  SUBMITTED: { text: "Submitted", cls: "bg-green-100 text-green-800" },
};

export default function MyDtrPage() {
  const today = todayIst();
  const [date, setDate] = useState(today);
  const [day, setDay] = useState<DtrDay | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [suggestions, setSuggestions] = useState<DtrSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a Submit that was missing a pending reason, those rows show red.
  const [checkReasons, setCheckReasons] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [dtr, sugg] = await Promise.all([getMyDtr(d), getMySuggestions(d)]);
      setDay(dtr);
      setRows(toRows(dtr.items));
      setSuggestions(sugg);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your DTR");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  const editable = Boolean(day?.editable);
  const usedKeys = new Set(rows.map((r) => r.sourceKey).filter(Boolean));
  const openSuggestions = suggestions.filter((s) => !usedKeys.has(s.key));

  const change = (key: string, patch: Partial<DtrItem>) => {
    setRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const addRow = (item?: Partial<DtrItem>) => {
    setRows((prev) => [
      ...prev,
      { _key: newKey(), task: "", status: "COMPLETED", pendingReason: "", remarks: "", ...item },
    ]);
    setDirty(true);
  };
  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r._key !== key));
    setDirty(true);
  };
  const addSuggestion = (s: DtrSuggestion) => addRow({ task: s.text, status: "COMPLETED", sourceKey: s.key });

  /** Rows that aren't Completed and have no "Pending Work with Reason". */
  const needsReason = (r: Row) =>
    !!r.task.trim() && r.status !== "COMPLETED" && !(r.pendingReason ?? "").trim();

  const save = async (submit: boolean) => {
    setError(null);
    setNotice(null);
    // Submitting (or changing a submitted DTR) needs every pending reason —
    // check here and point at the row, instead of a server error at the top.
    if (submit || day?.status === "SUBMITTED") {
      const missing = rows.filter(needsReason);
      if (missing.length > 0) {
        setCheckReasons(true);
        setError(
          missing.length === 1
            ? `Write the reason under "Pending Work with Reason" for: ${missing[0].task.trim()}`
            : `Write the reason under "Pending Work with Reason" for ${missing.length} tasks (marked in red).`,
        );
        // Laptop table or phone cards — use whichever is on screen.
        const el = [`reason-lg-${missing[0]._key}`, `reason-sm-${missing[0]._key}`]
          .map((id) => document.getElementById(id) as HTMLTextAreaElement | null)
          .find((x) => x && x.offsetParent !== null);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus({ preventScroll: true });
        return;
      }
    }
    setSaving(true);
    try {
      const items: DtrItem[] = rows
        .filter((r) => r.task.trim())
        .map(({ _key, ...r }) => {
          void _key;
          return r;
        });
      const saved = await saveMyDtr(date, items, submit);
      setDay(saved);
      setRows(toRows(saved.items));
      setDirty(false);
      setCheckReasons(false);
      setNotice(submit ? "DTR submitted. Thank you!" : "Draft saved.");
      setSuggestions(await getMySuggestions(date));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your DTR");
    } finally {
      setSaving(false);
    }
  };

  // Today and yesterday (yesterday is open until 10 AM, or if Admin re-opened it).
  const yesterday = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat("en-CA").format(d);
  })();

  const status = DAY_STATUS[day?.status ?? "NOT_STARTED"];
  const input =
    "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50";

  return (
    <div className="p-0 lg:p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">My DTR</h1>
      <p className="text-sm text-gray-500 mb-4">Daily Task Report — what you worked on today.</p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm">
            <CalendarDays size={16} className="text-indigo-600" />
            <select
              value={date}
              onChange={(e) => {
                if (dirty && !window.confirm("You have unsaved changes. Leave them?")) return;
                setDate(e.target.value);
              }}
              className="bg-transparent outline-none"
            >
              <option value={today}>{prettyDtrDate(today)} (today)</option>
              <option value={yesterday}>{prettyDtrDate(yesterday)} (yesterday)</option>
            </select>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.cls}`}>
            {status.text}
            {day?.status === "SUBMITTED" && day.submittedAt ? ` · ${prettyDateTime(day.submittedAt)}` : ""}
          </span>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <Lock size={13} />
          {editable && day?.editableUntil
            ? `Editable till ${prettyDateTime(day.editableUntil)}`
            : "Locked — ask Admin to re-open if something needs changing"}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">⚠️ {error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg text-sm mb-4">✓ {notice}</div>}

      {loading ? (
        <p className="py-10 text-center text-gray-500 text-sm">Loading…</p>
      ) : (
        <>
          {/* Suggestions — only this date's CRM work, only added on click */}
          {editable && openSuggestions.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-indigo-900">
                  <Sparkles size={17} /> From your work in the CRM on this day
                </div>
                <button
                  onClick={() => openSuggestions.forEach(addSuggestion)}
                  className="text-sm font-semibold text-indigo-700 hover:underline"
                >
                  Add all
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {openSuggestions.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-start justify-between gap-3 bg-white rounded-lg px-3 py-2 text-sm border border-indigo-100"
                  >
                    <span className="text-gray-800">{s.text}</span>
                    <button
                      onClick={() => addSuggestion(s)}
                      className="shrink-0 text-xs font-semibold text-indigo-700 flex items-center gap-1"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Laptop: table */}
          <div className="hidden lg:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2.5 text-left w-8">#</th>
                  <th className="px-3 py-2.5 text-left">Task Assigned / Planned</th>
                  <th className="px-3 py-2.5 text-left w-40">Status</th>
                  <th className="px-3 py-2.5 text-left">Pending Work with Reason</th>
                  <th className="px-3 py-2.5 text-left">Remarks</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No tasks yet. {editable ? "Add a row, or add from your CRM work above." : ""}
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={r._key} className="border-b border-gray-100 align-top">
                    <td className="px-3 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <textarea rows={2} disabled={!editable} value={r.task}
                        onChange={(e) => change(r._key, { task: e.target.value })} className={input} />
                    </td>
                    <td className="px-3 py-2">
                      <select disabled={!editable} value={r.status}
                        onChange={(e) => change(r._key, { status: e.target.value as DtrItemStatus })}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold border-0 ${DTR_STATUS_STYLE[r.status]}`}>
                        {DTR_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <textarea rows={2} disabled={!editable} value={r.pendingReason ?? ""}
                        id={`reason-lg-${r._key}`}
                        placeholder={r.status === "COMPLETED" ? "—" : "Required: what is pending and why"}
                        onChange={(e) => change(r._key, { pendingReason: e.target.value })}
                        className={`${input} ${checkReasons && needsReason(r) ? "border-red-500 ring-2 ring-red-200 bg-red-50" : ""}`} />
                      {checkReasons && needsReason(r) && (
                        <p className="text-[11px] text-red-600 mt-1">Required for In Progress / Pending</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <textarea rows={2} disabled={!editable} value={r.remarks ?? ""}
                        onChange={(e) => change(r._key, { remarks: e.target.value })} className={input} />
                    </td>
                    <td className="px-2 py-3">
                      {editable && (
                        <button title="Remove" onClick={() => removeRow(r._key)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: cards */}
          <div className="lg:hidden space-y-2.5">
            {rows.length === 0 && <p className="py-6 text-center text-gray-500 text-sm">No tasks yet.</p>}
            {rows.map((r, i) => (
              <div key={r._key} className="bg-white border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Task {i + 1}</span>
                  {editable && (
                    <button onClick={() => removeRow(r._key)} className="text-red-500"><Trash2 size={15} /></button>
                  )}
                </div>
                <textarea rows={2} disabled={!editable} value={r.task} placeholder="Task assigned / planned"
                  onChange={(e) => change(r._key, { task: e.target.value })} className={input} />
                <select disabled={!editable} value={r.status}
                  onChange={(e) => change(r._key, { status: e.target.value as DtrItemStatus })}
                  className={`w-full px-2 py-2 rounded-lg text-sm font-semibold border-0 ${DTR_STATUS_STYLE[r.status]}`}>
                  {DTR_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {r.status !== "COMPLETED" && (
                  <textarea rows={2} disabled={!editable} value={r.pendingReason ?? ""} placeholder="Pending work with reason (required)"
                    id={`reason-sm-${r._key}`}
                    onChange={(e) => change(r._key, { pendingReason: e.target.value })}
                    className={`${input} ${checkReasons && needsReason(r) ? "border-red-500 ring-2 ring-red-200 bg-red-50" : ""}`} />
                )}
                <textarea rows={1} disabled={!editable} value={r.remarks ?? ""} placeholder="Remarks"
                  onChange={(e) => change(r._key, { remarks: e.target.value })} className={input} />
              </div>
            ))}
          </div>

          {editable && error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {error}</div>
          )}
          {editable && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button onClick={() => addRow()}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium">
                <Plus size={15} /> Add row
              </button>
              <div className="flex gap-2 w-full sm:w-auto">
                <button disabled={saving} onClick={() => save(false)}
                  className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 bg-white rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                  Save draft
                </button>
                <button disabled={saving} onClick={() => save(true)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                  {saving ? "Saving…" : day?.status === "SUBMITTED" ? "Update submitted DTR" : "Submit DTR"}
                </button>
              </div>
            </div>
          )}

          {day?.reviewComment && (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <MessageSquare size={16} className="text-indigo-600" />
                Comment from {day.reviewCommentBy ?? "Admin"}
                {day.reviewCommentAt && <span className="text-xs font-normal text-gray-400">· {prettyDateTime(day.reviewCommentAt)}</span>}
              </div>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{day.reviewComment}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}