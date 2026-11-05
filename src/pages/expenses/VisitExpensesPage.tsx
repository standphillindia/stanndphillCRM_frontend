// src/pages/expenses/VisitExpensesPage.tsx
//
// Engineer visit expenses.
//   Engineer → "My visit expenses": every logged factory visit opens a
//              claim; add what it cost (category-wise, optional proof
//              photos) within 3 days. Submitting is final.
//   Admin    → every claim: review proofs, approve (full or less),
//              reject with a reason, mark paid, or reopen for the engineer.
//              Excel download of the filtered list.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { X, Plus, Trash2, Paperclip, Camera } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { visitRoles } from "../../utils/visitPermissions";
import { fetchMyModules } from "../../services/permissionService";
import { getApiErrorMessage } from "../../utils/apiError";
import PendingVisitReportsBanner from "../../components/projects/PendingVisitReportsBanner";
import { fetchUserDirectory, type UserResponse } from "../../services/userService";
import { resolveFileUrl, uploadVisitPhoto } from "../../services/projectStageService";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_WINDOW_DAYS,
  categoryLabel,
  fetchMyVisitExpenses,
  fetchAllVisitExpenses,
  submitVisitExpense,
  approveVisitExpense,
  rejectVisitExpense,
  markVisitExpensePaid,
  reopenVisitExpense,
  reassignVisitExpense,
  type ExpenseCategory,
  type ExpenseStatus,
  type VisitExpenseClaim,
} from "../../services/visitExpenseService";

// ── small helpers ─────────────────────────────────────────────────────
const rupees = (n: number | null | undefined) =>
  n == null ? "—" : `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const showDate = (d: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "—";
};

const showDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
      })
    : "—";

const timeLeft = (deadline: string) => {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Closed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} left`;
};

const STATUS_STYLE: Record<ExpenseStatus, string> = {
  OPEN: "bg-blue-100 text-blue-800",
  EXPIRED: "bg-gray-200 text-gray-700",
  SUBMITTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-700",
  PAID: "bg-emerald-600 text-white",
};

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  OPEN: "To fill",
  EXPIRED: "Closed (not filled)",
  SUBMITTED: "Waiting for review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

const StatusBadge = ({ s }: { s: ExpenseStatus }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[s]}`}>
    {STATUS_LABEL[s]}
  </span>
);

const isImage = (url: string) => /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(url);

// ══════════════════════════════════════════════════════════════════════
export default function VisitExpensesPage() {
  const { token } = useAuth();
  const isAdmin = visitRoles(token).isAdmin;
  // All-claims view: Admin, or a role given "Visit Expenses — all claims"
  // (VISIT_EXPENSES_REVIEW) in Users → Roles & Permissions, e.g. Finance.
  const [canReview, setCanReview] = useState<boolean | null>(isAdmin ? true : null);
  useEffect(() => {
    if (isAdmin) return;
    fetchMyModules()
      .then((m) => setCanReview(m.includes("VISIT_EXPENSES_REVIEW")))
      .catch(() => setCanReview(false));
  }, [isAdmin]);
  if (canReview === null) return <div className="p-6 text-sm text-gray-500">Loading…</div>;
  return canReview ? <AdminView /> : <EngineerView />;
}

// ── Engineer ──────────────────────────────────────────────────────────
function EngineerView() {
  const [claims, setClaims] = useState<VisitExpenseClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filling, setFilling] = useState<VisitExpenseClaim | null>(null);
  const [viewing, setViewing] = useState<VisitExpenseClaim | null>(null);

  // Arrived here straight after logging a visit (?project=<id>): point at
  // that visit's claim and open its form.
  const [searchParams, setSearchParams] = useSearchParams();
  const [justLogged, setJustLogged] = useState<VisitExpenseClaim | null>(null);
  // Came here from a visit but there's nothing to fill under my name.
  const [notFillable, setNotFillable] = useState<string | null>(null);

  const load = () =>
    fetchMyVisitExpenses()
      .then((data) => {
        setClaims(data);
        setError(null);
        const fromVisit = searchParams.get("project");
        if (fromVisit) {
          const claim = data.find((c) => c.projectId === fromVisit && c.canSubmit);
          if (claim) {
            setJustLogged(claim);
            setFilling(claim);
          } else {
            const mine = data.find((c) => c.projectId === fromVisit);
            setNotFillable(
              mine
                ? mine.status === "EXPIRED"
                  ? `The ${EXPENSE_WINDOW_DAYS}-day window to add the expense for ${mine.projectName} ended on ${showDateTime(mine.deadline)}. Ask Admin to reopen it (Visit Expenses → the claim → Reopen for engineer).`
                  : `The expense for ${mine.projectName} is already ${STATUS_LABEL[mine.status].toLowerCase()} — see it below.`
                : "No visit expense is open in your name for this visit. It may be under the engineer assigned to the project. Ask Admin to move it to you (Visit Expenses → the claim → Change engineer)."
            );
          }
          setSearchParams({}, { replace: true });
        }
      })
      .catch((e) => setError(getApiErrorMessage(e, "Could not load your visit expenses.")));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const toFill = (claims ?? []).filter((c) => c.canSubmit);
  const rest = (claims ?? []).filter((c) => !c.canSubmit);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My visit expenses</h1>
        <p className="text-sm text-gray-500">
          After every factory visit, add what you spent within {EXPENSE_WINDOW_DAYS} days — travel, food, stay,
          courier. Bill photos are optional. Once submitted it can't be changed; Admin approves it.
        </p>
      </div>

      {/* Visits whose document checklist / basic info is still to fill. */}
      <PendingVisitReportsBanner />

      {justLogged && justLogged.canSubmit && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              Visit logged for {justLogged.projectName}. Fill its expense within {EXPENSE_WINDOW_DAYS} days.
            </p>
            <p>After {showDateTime(justLogged.deadline)} this option closes and only Admin can reopen it.</p>
          </div>
          <button
            onClick={() => setFilling(justLogged)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
          >
            Add expense now
          </button>
        </div>
      )}

      {notFillable && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start justify-between gap-3">
          <p>{notFillable}</p>
          <button onClick={() => setNotFillable(null)} className="p-1 rounded hover:bg-amber-100" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!claims && !error && <p className="text-sm text-gray-500">Loading…</p>}
      {claims && claims.length === 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
          No visits yet. When you log a factory visit, it shows up here to add its expense.
        </div>
      )}

      {toFill.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-blue-800 mb-2">To fill ({toFill.length})</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {toFill.map((c) => (
              <div key={c.id} className="rounded-xl border border-blue-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/projects/${c.projectId}/stages`} className="font-medium text-gray-900 hover:underline">
                      {c.projectName ?? "Project"}
                    </Link>
                    <p className="text-xs text-gray-500">
                      Visit {showDate(c.visitDate)} · {c.visitOutcome === "FAILED" ? "Visit failed" : "Visit completed"}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-blue-800 whitespace-nowrap">{timeLeft(c.deadline)}</span>
                </div>
                <button
                  onClick={() => setFilling(c)}
                  className="mt-3 w-full sm:w-auto px-3 py-3 sm:py-1.5 rounded-lg text-base sm:text-sm font-semibold sm:font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add expense
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">History</h2>
          {/* Phone: one card per claim. */}
          <div className="sm:hidden space-y-2">
            {rest.map((c) => (
              <button
                key={c.id}
                onClick={() => setViewing(c)}
                className="w-full text-left rounded-xl border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-900">{c.projectName}</span>
                  <StatusBadge s={c.status} />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">Visit {showDate(c.visitDate)}</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-600">Claimed <b className="text-gray-900">{rupees(c.totalAmount)}</b></span>
                  <span className="text-gray-600">Approved <b className="text-gray-900">{rupees(c.approvedAmount)}</b></span>
                </div>
                {c.status === "REJECTED" && c.adminNote && (
                  <p className="mt-1 text-xs text-red-700 line-clamp-2">{c.adminNote}</p>
                )}
              </button>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                  <th className="p-3 text-left">Project</th>
                  <th className="p-3 text-left">Visit</th>
                  <th className="p-3 text-right">Claimed</th>
                  <th className="p-3 text-right">Approved</th>
                  <th className="p-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rest.map((c) => (
                  <tr key={c.id} onClick={() => setViewing(c)} className="border-b hover:bg-gray-50 cursor-pointer">
                    <td className="p-3 font-medium">{c.projectName}</td>
                    <td className="p-3">{showDate(c.visitDate)}</td>
                    <td className="p-3 text-right">{rupees(c.totalAmount)}</td>
                    <td className="p-3 text-right">{rupees(c.approvedAmount)}</td>
                    <td className="p-3">
                      <StatusBadge s={c.status} />
                      {c.status === "REJECTED" && c.adminNote && (
                        <span className="block text-xs text-red-700 mt-0.5 line-clamp-1">{c.adminNote}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {filling && (
        <ExpenseForm
          claim={filling}
          onClose={() => setFilling(null)}
          onSubmitted={() => { setFilling(null); setJustLogged(null); load(); }}
        />
      )}
      {viewing && <ClaimDetails claim={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

// ── Engineer: fill & submit ───────────────────────────────────────────
// Shown on the category buttons on a phone.
const CATEGORY_ICON: Record<string, string> = {
  TRAVEL: "🚆", FOOD: "🍽", STAY: "🏨", COURIER: "📦", OTHER: "➕",
};

interface Row { key: number; category: ExpenseCategory | ""; amount: string; description: string }

function ExpenseForm({ claim, onClose, onSubmitted }: {
  claim: VisitExpenseClaim; onClose: () => void; onSubmitted: () => void;
}) {
  const { addToast } = useToast();
  const [rows, setRows] = useState<Row[]>([{ key: 1, category: "TRAVEL", amount: "", description: "" }]);
  const [proofs, setProofs] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = rows.reduce((s, r) => s + (Number(r.amount) > 0 ? Number(r.amount) : 0), 0);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files).slice(0, 10 - proofs.length)) {
        const url = await uploadVisitPhoto(f);
        setProofs((p) => [...p, { url, name: f.name }]);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not upload the file. Try a photo or PDF under 10 MB."));
    } finally {
      setUploading(false);
    }
  };

  const check = (): string | null => {
    if (rows.length === 0) return "Add at least one expense item.";
    for (const r of rows) {
      if (!r.category) return "Pick a category for every item.";
      if (!(Number(r.amount) > 0)) return "Every item needs an amount above ₹0.";
      if (r.category === "OTHER" && !r.description.trim()) return 'Write what the "Other" expense was for.';
    }
    return null;
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await submitVisitExpense(claim.id, {
        items: rows.map((r) => ({
          category: r.category as ExpenseCategory,
          amount: Number(r.amount),
          description: r.description.trim() || undefined,
        })),
        proofUrls: proofs.map((p) => p.url),
        note: note.trim() || undefined,
      });
      addToast({ title: "Submitted", message: `Expense of ${rupees(total)} sent to Admin.`, type: "success" });
      onSubmitted();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not submit. Please try again."));
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-9 px-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4">
      {/* Full screen on a phone, a dialog on a laptop. */}
      <div className="bg-white sm:rounded-xl shadow-2xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Add visit expense</h2>
            <p className="text-sm text-gray-500 truncate">
              {claim.projectName} · visit {showDate(claim.visitDate)} · {timeLeft(claim.deadline)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.key}>
              {/* Phone: big category buttons, number keypad for the amount. */}
              <div className="sm:hidden rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">What did you spend on?</p>
                  <button
                    onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                    disabled={rows.length === 1}
                    className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove item"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXPENSE_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => update(r.key, { category: c.value })}
                      className={`py-2.5 rounded-xl border text-xs font-semibold ${
                        r.category === c.value ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700"
                      }`}
                    >
                      {CATEGORY_ICON[c.value]} {c.label}
                    </button>
                  ))}
                </div>
                <input
                  type="number" min={0} step="1" inputMode="decimal" placeholder="₹ Amount"
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value })}
                  className="w-full h-12 px-3 rounded-xl border border-gray-300 text-lg font-semibold outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <input
                  type="text" maxLength={500}
                  placeholder={EXPENSE_CATEGORIES.find((c) => c.value === r.category)?.hint ?? "Details"}
                  value={r.description}
                  onChange={(e) => update(r.key, { description: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div className="hidden sm:grid grid-cols-12 gap-2 items-start">
                <select
                  value={r.category}
                  onChange={(e) => update(r.key, { category: e.target.value as ExpenseCategory })}
                  className={`${inputCls} col-span-4 sm:col-span-3`}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value} title={c.hint}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="number" min={0} step="1" inputMode="decimal" placeholder="₹ Amount"
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value })}
                  className={`${inputCls} col-span-3 sm:col-span-2 text-right`}
                />
                <input
                  type="text" maxLength={500}
                  placeholder={EXPENSE_CATEGORIES.find((c) => c.value === r.category)?.hint ?? "Details"}
                  value={r.description}
                  onChange={(e) => update(r.key, { description: e.target.value })}
                  className={`${inputCls} col-span-4 sm:col-span-6`}
                />
                <button
                  onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                  disabled={rows.length === 1}
                  className="col-span-1 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setRows((p) => [...p, { key: Date.now(), category: "TRAVEL", amount: "", description: "" }])}
                disabled={rows.length >= 20}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline disabled:opacity-40"
              >
                <Plus size={14} /> Add item
              </button>
              <p className="text-sm">Total <span className="text-lg font-bold text-gray-900">{rupees(total)}</span></p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Proof (optional)</p>
            {/* Phone: open the camera straight away for the bill. */}
            <label className="sm:hidden mr-2 mb-2 inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-blue-400 bg-blue-50 text-sm font-medium text-blue-800 cursor-pointer">
              <Camera size={16} />
              {uploading ? "Uploading…" : "Take photo"}
              <input
                type="file" accept="image/*" capture="environment" className="hidden"
                disabled={uploading || proofs.length >= 10}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-400 text-sm text-gray-700 cursor-pointer hover:bg-gray-50">
              <Paperclip size={14} />
              {uploading ? "Uploading…" : "Attach bill / ticket photos"}
              <input
                type="file" accept="image/*,.pdf" multiple className="hidden"
                disabled={uploading || proofs.length >= 10}
                onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
              />
            </label>
            {proofs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {proofs.map((p) => (
                  <div key={p.url} className="relative">
                    {isImage(p.url) ? (
                      <img src={resolveFileUrl(p.url) ?? ""} alt={p.name} className="h-16 w-16 object-cover rounded border" />
                    ) : (
                      <div className="h-16 w-16 rounded border bg-gray-50 text-[10px] p-1 break-all">{p.name}</div>
                    )}
                    <button
                      onClick={() => setProofs((x) => x.filter((y) => y.url !== p.url))}
                      className="absolute -top-2 -right-2 bg-white rounded-full border p-0.5 text-gray-600 hover:text-red-600"
                      aria-label="Remove file"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Note (optional)</p>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000}
              placeholder="Anything Admin should know"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t">
          {confirming ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-amber-800">
                Submit {rupees(total)}? <b>You can't change it after this</b> — Admin decides from here.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirming(false)} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Back</button>
                <button
                  onClick={submit} disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-50"
                >
                  {saving ? "Submitting…" : "Yes, submit"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => { const msg = check(); if (msg) setError(msg); else { setError(null); setConfirming(true); } }}
                disabled={uploading}
                className="flex-1 sm:flex-none px-4 py-3 sm:py-2 rounded-lg text-sm font-semibold sm:font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Submit expense<span className="sm:hidden"> {rupees(total)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Shared: one claim's details (+ Admin actions) ─────────────────────
function ClaimDetails({ claim, onClose, admin = false, onChanged }: {
  claim: VisitExpenseClaim; onClose: () => void; admin?: boolean; onChanged?: (c: VisitExpenseClaim) => void;
}) {
  const { addToast } = useToast();
  const [mode, setMode] = useState<"none" | "approve" | "reject" | "paid" | "reopen" | "reassign">("none");
  // Change engineer: the engineers to pick from (loaded when that mode opens).
  const [engineers, setEngineers] = useState<UserResponse[]>([]);
  const [toEngineer, setToEngineer] = useState("");
  const [amount, setAmount] = useState(String(claim.totalAmount ?? ""));
  const [note, setNote] = useState("");
  const [days, setDays] = useState(String(EXPENSE_WINDOW_DAYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async () => {
    setBusy(true);
    setError(null);
    try {
      let updated: VisitExpenseClaim;
      if (mode === "approve") updated = await approveVisitExpense(claim.id, amount ? Number(amount) : undefined, note || undefined);
      else if (mode === "reject") updated = await rejectVisitExpense(claim.id, note);
      else if (mode === "paid") updated = await markVisitExpensePaid(claim.id, note || undefined);
      else if (mode === "reassign") {
        if (!toEngineer) throw new Error("Pick the engineer who did this visit.");
        updated = await reassignVisitExpense(claim.id, toEngineer, Number(days) || EXPENSE_WINDOW_DAYS);
      }
      else updated = await reopenVisitExpense(claim.id, Number(days) || EXPENSE_WINDOW_DAYS, note || undefined);
      addToast({
        title: "Saved",
        message: mode === "reassign"
          ? `Expense moved to ${updated.engineerName ?? updated.engineerEmail}.`
          : `Expense ${STATUS_LABEL[updated.status].toLowerCase()}.`,
        type: "success",
      });
      setMode("none");
      setNote("");
      onChanged?.(updated);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not save. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const s = claim.status;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{claim.projectName}</h2>
            <p className="text-sm text-gray-500">
              {claim.engineerName ?? claim.engineerEmail} · visit {showDate(claim.visitDate)} ·{" "}
              {claim.visitOutcome === "FAILED" ? "visit failed" : "visit completed"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge s={s} />
            {s === "OPEN" && <span className="text-xs text-gray-500">Engineer can fill till {showDateTime(claim.deadline)}</span>}
            {s === "EXPIRED" && <span className="text-xs text-gray-500">Window closed {showDateTime(claim.deadline)}</span>}
            {claim.submittedAt && <span className="text-xs text-gray-500">Submitted {showDateTime(claim.submittedAt)}</span>}
          </div>

          {claim.items.length > 0 ? (
            <table className="w-full">
              <tbody>
                {claim.items.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2 font-medium whitespace-nowrap">{categoryLabel(it.category)}</td>
                    <td className="py-1.5 pr-2 text-gray-600">{it.description ?? ""}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{rupees(it.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-2 font-semibold" colSpan={2}>Claimed</td>
                  <td className="pt-2 text-right font-bold">{rupees(claim.totalAmount)}</td>
                </tr>
                {claim.approvedAmount != null && (
                  <tr>
                    <td className="font-semibold text-green-800" colSpan={2}>Approved</td>
                    <td className="text-right font-bold text-green-800">{rupees(claim.approvedAmount)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p className="text-gray-500">No expense submitted yet.</p>
          )}

          {claim.proofUrls.length > 0 && (
            <div>
              <p className="font-medium text-gray-700 mb-1">Proof</p>
              <div className="flex flex-wrap gap-2">
                {claim.proofUrls.map((u) => (
                  <a key={u} href={resolveFileUrl(u) ?? "#"} target="_blank" rel="noreferrer">
                    {isImage(u) ? (
                      <img src={resolveFileUrl(u) ?? ""} alt="Proof" className="h-20 w-20 object-cover rounded border hover:opacity-80" />
                    ) : (
                      <span className="inline-block h-20 w-20 rounded border bg-gray-50 p-2 text-xs text-blue-700">Open file</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {claim.engineerNote && (
            <p className="rounded-lg bg-gray-50 px-3 py-2"><b>Engineer's note:</b> {claim.engineerNote}</p>
          )}
          {claim.adminNote && (
            <p className={`rounded-lg px-3 py-2 ${s === "REJECTED" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-900"}`}>
              <b>Admin:</b> {claim.adminNote}
              {claim.decidedByName && <span className="text-xs text-gray-500"> — {claim.decidedByName}, {showDateTime(claim.decidedAt)}</span>}
            </p>
          )}
          {claim.paidAt && <p className="text-emerald-800">Paid on {showDateTime(claim.paidAt)}</p>}

          {/* ── Admin actions ── */}
          {admin && (
            <div className="border-t pt-3 space-y-3">
              {mode === "none" ? (
                <div className="flex flex-wrap gap-2">
                  {s === "SUBMITTED" && (
                    <>
                      <button onClick={() => setMode("approve")} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800">Approve</button>
                      <button onClick={() => setMode("reject")} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">Reject</button>
                    </>
                  )}
                  {s === "APPROVED" && (
                    <button onClick={() => setMode("paid")} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800">Mark paid</button>
                  )}
                  {(s === "SUBMITTED" || s === "REJECTED" || s === "EXPIRED" || s === "OPEN") && (
                    <button onClick={() => setMode("reopen")} className="px-3 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50">
                      {s === "OPEN" ? "Extend time" : "Reopen for engineer"}
                    </button>
                  )}
                  {(s === "OPEN" || s === "EXPIRED" || s === "REJECTED" || s === "SUBMITTED") && (
                    <button
                      onClick={() => {
                        setMode("reassign");
                        if (engineers.length === 0) {
                          fetchUserDirectory()
                            .then((us) => setEngineers(us.filter((u) =>
                              u.status === "ACTIVE" && (u.role === "ENGINEER" || (u.department ?? "").toLowerCase().startsWith("engineer")))))
                            .catch(() => setError("Could not load engineers."));
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50"
                    >
                      Change engineer
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {mode === "approve" && (
                    <label className="block">
                      <span className="text-gray-700">Approved amount (₹)</span>
                      <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="mt-1 w-40 h-9 px-2 rounded-lg border border-gray-300 text-right" />
                      <span className="ml-2 text-xs text-gray-500">Claimed {rupees(claim.totalAmount)}</span>
                    </label>
                  )}
                  {mode === "reassign" && (
                    <div className="space-y-2">
                      <label className="block">
                        <span className="text-gray-700">Engineer who did this visit</span>
                        <select value={toEngineer} onChange={(e) => setToEngineer(e.target.value)}
                          className="mt-1 block w-full h-9 px-2 rounded-lg border border-gray-300">
                          <option value="">— Pick engineer —</option>
                          {engineers.filter((u) => u.email !== claim.engineerEmail).map((u) => (
                            <option key={u.email} value={u.email}>{u.fullName || u.email}</option>
                          ))}
                        </select>
                      </label>
                      {s !== "SUBMITTED" && (
                        <label className="block">
                          <span className="text-gray-700">Give them</span>
                          <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)}
                            className="mx-2 w-16 h-9 px-2 rounded-lg border border-gray-300 text-right" />
                          <span className="text-gray-700">day(s) to submit</span>
                        </label>
                      )}
                    </div>
                  )}
                  {mode === "reopen" && (
                    <label className="block">
                      <span className="text-gray-700">Give the engineer</span>
                      <input type="number" min={1} max={30} value={days} onChange={(e) => setDays(e.target.value)}
                        className="mx-2 w-16 h-9 px-2 rounded-lg border border-gray-300 text-right" />
                      <span className="text-gray-700">day(s) to submit</span>
                    </label>
                  )}
                  {mode !== "reassign" && <textarea
                    value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                    placeholder={mode === "reject" ? "Why is it rejected? (required — the engineer sees this)" : "Note (optional)"}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                  />}
                  {error && <p className="text-red-600">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setMode("none"); setError(null); }} className="px-3 py-1.5 rounded-lg border hover:bg-gray-50">Back</button>
                    <button
                      onClick={act}
                      disabled={busy || (mode === "reject" && !note.trim()) || (mode === "reassign" && !toEngineer)}
                      className="px-3 py-1.5 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : mode === "approve" ? "Approve" : mode === "reject" ? "Reject" : mode === "paid" ? "Mark paid" : mode === "reassign" ? "Move to engineer" : "Reopen"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Admin ─────────────────────────────────────────────────────────────
type Tab = "SUBMITTED" | "APPROVED" | "PAID" | "REJECTED" | "OPEN" | "EXPIRED" | "ALL";
const TABS: { key: Tab; label: string }[] = [
  { key: "SUBMITTED", label: "To review" },
  { key: "APPROVED", label: "Approved (to pay)" },
  { key: "PAID", label: "Paid" },
  { key: "REJECTED", label: "Rejected" },
  { key: "OPEN", label: "Engineer yet to fill" },
  { key: "EXPIRED", label: "Not filled in time" },
  { key: "ALL", label: "All" },
];

function AdminView() {
  const [claims, setClaims] = useState<VisitExpenseClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("SUBMITTED");
  const [engineer, setEngineer] = useState("");
  const [month, setMonth] = useState(""); // yyyy-MM of the visit date
  const [viewing, setViewing] = useState<VisitExpenseClaim | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAllVisitExpenses()
      .then((data) => { setClaims(data); setError(null); })
      .catch((e) => setError(getApiErrorMessage(e, "Could not load visit expenses.")));
  }, []);

  const engineers = useMemo(() => {
    const m = new Map<string, string>();
    (claims ?? []).forEach((c) => m.set(c.engineerEmail, c.engineerName ?? c.engineerEmail));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [claims]);

  const months = useMemo(
    () => Array.from(new Set((claims ?? []).map((c) => (c.visitDate ?? "").slice(0, 7)).filter(Boolean))).sort().reverse(),
    [claims]
  );

  const filtered = useMemo(
    () =>
      (claims ?? []).filter(
        (c) =>
          (!engineer || c.engineerEmail === engineer) &&
          (!month || (c.visitDate ?? "").startsWith(month))
      ),
    [claims, engineer, month]
  );
  const shown = tab === "ALL" ? filtered : filtered.filter((c) => c.status === tab);
  const count = (t: Tab) => (t === "ALL" ? filtered.length : filtered.filter((c) => c.status === t).length);

  const sum = (list: VisitExpenseClaim[], f: (c: VisitExpenseClaim) => number | null) =>
    list.reduce((s, c) => s + Number(f(c) ?? 0), 0);
  const totals = {
    toReview: sum(filtered.filter((c) => c.status === "SUBMITTED"), (c) => c.totalAmount),
    toPay: sum(filtered.filter((c) => c.status === "APPROVED"), (c) => c.approvedAmount),
    paid: sum(filtered.filter((c) => c.status === "PAID"), (c) => c.approvedAmount),
  };

  const replace = (u: VisitExpenseClaim) => {
    setClaims((prev) => (prev ?? []).map((c) => (c.id === u.id ? u : c)));
    setViewing(u);
  };

  const downloadExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Visit Expenses", { views: [{ state: "frozen", ySplit: 1 }] });
      const cats = EXPENSE_CATEGORIES.map((c) => c.value);
      ws.columns = [
        { header: "Visit date", key: "visit", width: 12 },
        { header: "Engineer", key: "eng", width: 22 },
        { header: "Project", key: "proj", width: 34 },
        { header: "Visit result", key: "out", width: 12 },
        ...EXPENSE_CATEGORIES.map((c) => ({ header: c.label, key: c.value, width: 11 })),
        { header: "Claimed", key: "claimed", width: 12 },
        { header: "Approved", key: "approved", width: 12 },
        { header: "Status", key: "status", width: 18 },
        { header: "Submitted", key: "submitted", width: 16 },
        { header: "Paid on", key: "paid", width: 16 },
        { header: "Engineer note", key: "enote", width: 30 },
        { header: "Admin note", key: "anote", width: 30 },
        { header: "Proof files", key: "proofs", width: 10 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      shown.forEach((c) => {
        const byCat: Record<string, number> = {};
        c.items.forEach((it) => { byCat[it.category] = (byCat[it.category] ?? 0) + Number(it.amount); });
        ws.addRow({
          visit: showDate(c.visitDate),
          eng: c.engineerName ?? c.engineerEmail,
          proj: c.projectName ?? "",
          out: c.visitOutcome === "FAILED" ? "Failed" : "Completed",
          ...Object.fromEntries(cats.map((k) => [k, byCat[k] ?? null])),
          claimed: c.totalAmount,
          approved: c.approvedAmount,
          status: STATUS_LABEL[c.status],
          submitted: c.submittedAt ? showDateTime(c.submittedAt) : "",
          paid: c.paidAt ? showDateTime(c.paidAt) : "",
          enote: c.engineerNote ?? "",
          anote: c.adminNote ?? "",
          proofs: c.proofUrls.length,
        });
      });
      const totalRow = ws.addRow({
        proj: "Total",
        claimed: sum(shown, (c) => c.totalAmount),
        approved: sum(shown, (c) => c.approvedAmount),
      });
      totalRow.font = { bold: true };
      ["claimed", "approved", ...cats].forEach((k) => { ws.getColumn(k).numFmt = "#,##,##0.00"; });

      const buffer = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      a.download = `visit-expenses_${month || "all"}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not create the Excel file."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visit expenses</h1>
          <p className="text-sm text-gray-500">
            Engineers add a visit's expense within {EXPENSE_WINDOW_DAYS} days of logging it. Submitted expenses are final for them — you decide.
          </p>
        </div>
        <button
          onClick={downloadExcel}
          disabled={exporting || shown.length === 0}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-green-700 hover:bg-green-800 disabled:opacity-40"
        >
          {exporting ? "Preparing…" : "Download Excel"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          ["To review", totals.toReview, `${count("SUBMITTED")} claims`],
          ["Approved, not paid", totals.toPay, `${count("APPROVED")} claims`],
          ["Paid", totals.paid, `${count("PAID")} claims`],
        ].map(([label, value, sub]) => (
          <div key={label as string} className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{rupees(value as number)}</p>
            <p className="text-xs text-gray-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={engineer} onChange={(e) => setEngineer(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm">
          <option value="">All engineers</option>
          {engineers.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-300 text-sm">
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {new Date(m + "-01T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === t.key ? "border-blue-700 text-blue-800" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label} <span className="text-xs text-gray-400">({count(t.key)})</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
              <th className="p-3 text-left">Engineer</th>
              <th className="p-3 text-left">Project</th>
              <th className="p-3 text-left">Visit</th>
              <th className="p-3 text-right">Claimed</th>
              <th className="p-3 text-right">Approved</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Proof</th>
            </tr>
          </thead>
          <tbody>
            {!claims && !error ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">Nothing here.</td></tr>
            ) : (
              shown.map((c) => (
                <tr key={c.id} onClick={() => setViewing(c)} className="border-b hover:bg-gray-50 cursor-pointer">
                  <td className="p-3 font-medium">{c.engineerName ?? c.engineerEmail}</td>
                  <td className="p-3 max-w-[260px] truncate" title={c.projectName ?? ""}>{c.projectName}</td>
                  <td className="p-3 whitespace-nowrap">
                    {showDate(c.visitDate)}
                    {c.visitOutcome === "FAILED" && <span className="ml-1 text-xs text-red-700">(failed)</span>}
                  </td>
                  <td className="p-3 text-right">{rupees(c.totalAmount)}</td>
                  <td className="p-3 text-right">{rupees(c.approvedAmount)}</td>
                  <td className="p-3">
                    <StatusBadge s={c.status} />
                    {c.status === "OPEN" && <span className="block text-xs text-gray-500">{timeLeft(c.deadline)}</span>}
                  </td>
                  <td className="p-3 text-xs text-gray-600">{c.proofUrls.length ? `${c.proofUrls.length} file(s)` : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewing && <ClaimDetails claim={viewing} admin onClose={() => setViewing(null)} onChanged={replace} />}
    </div>
  );
}