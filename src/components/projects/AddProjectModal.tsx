// src/components/projects/AddProjectModal.tsx
//
// Manual "Add Project" for projects that were already running before the
// CRM. Admin picks the stage the project has actually reached; every group
// before it is recorded as done, that group becomes active, and the rest
// stay pending (backend: POST /api/projects/import).

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  importProject,
  type ImportProjectRequest,
  type ImportScheduleMode,
  type ProjectResponse,
} from "../../services/projectService";
import {
  fetchStageDefinitionsForProjects,
  type ProjectStageDefinition,
} from "../../services/projectStageService";
import { fetchUserDirectory, type UserResponse } from "../../services/userService";
import { fetchDepartments, type OrgSetupOption } from "../../services/orgsetupservice";
import { getCertificationTypes, type CertificationTypeOption } from "../../services/quotationService";
import { getApiErrorMessage } from "../../utils/apiError";

interface Props {
  onClose: () => void;
  onCreated: (project: ProjectResponse) => void;
}

// ── Date helpers (yyyy-MM-dd, timezone-safe) ─────────────────────────────
const pad = (n: number) => String(n).padStart(2, "0");
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const inputCls =
  "w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

interface StageGroup {
  groupOrder: number;
  stages: ProjectStageDefinition[];
  dayStart: number | null;
  dayEnd: number | null;
  dynamic: boolean;
}

export default function AddProjectModal({ onClose, onCreated }: Props) {
  // ── Reference data ──────────────────────────────────────────────────
  const [defs, setDefs] = useState<ProjectStageDefinition[]>([]);
  const [users, setUsers] = useState<UserResponse[]>([]);
  const [departments, setDepartments] = useState<OrgSetupOption[]>([]);
  const [certTypes, setCertTypes] = useState<CertificationTypeOption[]>([]);
  const [refLoading, setRefLoading] = useState(true);
  const [refError, setRefError] = useState<string | null>(null);

  // ── Form ────────────────────────────────────────────────────────────
  const [startStageCode, setStartStageCode] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ImportScheduleMode>("FROM_TODAY");
  const [originalStartDate, setOriginalStartDate] = useState("");
  const [auditDate, setAuditDate] = useState("");
  const [showSkipped, setShowSkipped] = useState(false);

  const [form, setForm] = useState({
    companyName: "",
    projectName: "",
    certificationType: "",
    contactName: "",
    email: "",
    phone: "",
    gstNumber: "",
    customerPanNo: "",
    billingAddress: "",
    city: "",
    state: "",
    pincode: "",
    paymentTerms: "",
    amount: "",
    deadline: "",
    notes: "",
    engineerId: "",
    opsPersonId: "",
    ownerId: "",
    departmentId: "",
  });
  const set = (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [key]: e.target.value }));

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, u, dep] = await Promise.all([
          fetchStageDefinitionsForProjects(),
          // Name list open to everyone (Operations can add projects too,
          // without needing access to the Users screen).
          fetchUserDirectory(),
          fetchDepartments(),
        ]);
        if (cancelled) return;
        setDefs(d);
        setUsers(u);
        setDepartments(dep);
        if (d.length > 0) setStartStageCode(d[0].stageCode);
      } catch (e) {
        if (!cancelled) setRefError(getApiErrorMessage(e, "Could not load stages and users."));
      } finally {
        if (!cancelled) setRefLoading(false);
      }
      // Optional — the form falls back to a text box if this fails.
      getCertificationTypes()
        .then((c) => { if (!cancelled) setCertTypes(c); })
        .catch(() => undefined);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived: groups, selection, preview ─────────────────────────────
  const groups: StageGroup[] = useMemo(() => {
    const map = new Map<number, ProjectStageDefinition[]>();
    for (const d of defs) {
      if (!map.has(d.groupOrder)) map.set(d.groupOrder, []);
      map.get(d.groupOrder)!.push(d);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([groupOrder, stages]) => {
        const starts = stages.map((s) => s.dayStart).filter((n): n is number => n != null);
        const ends = stages.map((s) => s.dayEnd).filter((n): n is number => n != null);
        return {
          groupOrder,
          stages,
          dayStart: starts.length ? Math.min(...starts) : null,
          dayEnd: ends.length ? Math.max(...ends) : null,
          dynamic: stages.every((s) => s.dynamicDueDate),
        };
      });
  }, [defs]);

  const selectedGroup = useMemo(() => {
    const def = defs.find((d) => d.stageCode === startStageCode);
    return def ? groups.find((g) => g.groupOrder === def.groupOrder) ?? null : null;
  }, [defs, groups, startStageCode]);

  const skippedStages = useMemo(
    () => (selectedGroup ? defs.filter((d) => d.groupOrder < selectedGroup.groupOrder) : []),
    [defs, selectedGroup]
  );

  const skippedCodes = new Set(skippedStages.map((s) => s.stageCode));
  const auditCompleteSkipped = skippedCodes.has("AUDIT_COMPLETE");
  const auditScheduleSkipped = skippedCodes.has("AUDIT_SCHEDULE");
  const needsAuditDate = auditCompleteSkipped || auditScheduleSkipped;

  // Same Day-1 rule as the backend, so the preview matches what gets saved.
  const today = todayIso();
  const dayOne: string | null = useMemo(() => {
    if (!selectedGroup) return null;
    if (scheduleMode === "FROM_ORIGINAL_START") return originalStartDate || null;
    return selectedGroup.dayStart != null ? addDays(today, -(selectedGroup.dayStart - 1)) : today;
  }, [selectedGroup, scheduleMode, originalStartDate, today]);

  const dueFor = (s: ProjectStageDefinition): string | null => {
    if (!s.dynamicDueDate && s.dayEnd != null) return dayOne ? addDays(dayOne, s.dayEnd - 1) : null;
    if (!auditDate) return null;
    // Mirrors the backend's audit-chain anchoring for the active group.
    if (auditCompleteSkipped && ["FINAL_PI", "FINAL_PAYMENT_TI", "FINAL_MAIL_CERTIFICATE"].includes(s.stageCode)) {
      return auditDate;
    }
    if (!auditCompleteSkipped && auditScheduleSkipped) {
      if (s.stageCode === "AUDIT_VISIT_TICKET") return addDays(auditDate, -2);
      if (s.stageCode === "AUDIT_COMPLETE") return auditDate;
    }
    return null;
  };

  const activeLateCount = selectedGroup
    ? selectedGroup.stages.filter((s) => {
        const due = dueFor(s);
        return due != null && due < today;
      }).length
    : 0;

  const engineers = users.filter((u) => u.role === "ENGINEER");
  const salesUsers = users.filter((u) => u.role === "SALES" || u.role === "ADMIN");
  const userLabel = (u: UserResponse) => `${u.fullName} (${u.email})`;

  // ── Submit ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedGroup) return setError("Pick the stage this project is currently at.");
    if (!form.companyName.trim()) return setError("Company name is required.");
    if (scheduleMode === "FROM_ORIGINAL_START" && !originalStartDate) {
      return setError("Enter the original start date, or start the timeline from today.");
    }

    const opt = (v: string) => (v.trim() ? v.trim() : undefined);
    const req: ImportProjectRequest = {
      companyName: form.companyName.trim(),
      projectName: opt(form.projectName),
      certificationType: opt(form.certificationType),
      contactName: opt(form.contactName),
      email: opt(form.email),
      phone: opt(form.phone),
      gstNumber: opt(form.gstNumber),
      customerPanNo: opt(form.customerPanNo),
      billingAddress: opt(form.billingAddress),
      city: opt(form.city),
      state: opt(form.state),
      pincode: opt(form.pincode),
      paymentTerms: opt(form.paymentTerms),
      notes: opt(form.notes),
      amount: form.amount ? Number(form.amount) : undefined,
      deadline: opt(form.deadline),
      engineerId: opt(form.engineerId),
      opsPersonId: opt(form.opsPersonId),
      ownerId: opt(form.ownerId),
      departmentId: opt(form.departmentId),
      startGroup: selectedGroup.groupOrder,
      scheduleMode,
      originalStartDate: opt(originalStartDate),
      auditDate: needsAuditDate ? opt(auditDate) : undefined,
    };

    setSubmitting(true);
    try {
      const created = await importProject(req);
      onCreated(created);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not add the project."));
    } finally {
      setSubmitting(false);
    }
  };

  const groupLabel = (g: StageGroup) =>
    `Group ${g.groupOrder}` +
    (g.dynamic ? " · after audit" : g.dayStart != null ? ` · Day ${g.dayStart}${g.dayEnd && g.dayEnd !== g.dayStart ? `–${g.dayEnd}` : ""}` : "");

  // ── Render ──────────────────────────────────────────────────────────
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Project</h2>
            <p className="text-sm text-gray-500">
              For a project already running outside the CRM. Choose the stage it has reached; earlier stages are marked done.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {refLoading ? (
          <div className="p-10 text-center text-gray-500 text-sm">Loading stages…</div>
        ) : refError ? (
          <div className="p-6">
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{refError}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">
              {/* ── 1. Where is the project now ─────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">1. Where is this project now?</h3>

                <label className={labelCls}>Current stage *</label>
                <select
                  value={startStageCode}
                  onChange={(e) => setStartStageCode(e.target.value)}
                  className={inputCls}
                >
                  {groups.map((g) => (
                    <optgroup key={g.groupOrder} label={groupLabel(g)}>
                      {g.stages.map((s) => (
                        <option key={s.stageCode} value={s.stageCode}>
                          {s.displayName} — {s.responsibleDepartment}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {selectedGroup && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-sm">
                    <p className="font-medium text-blue-900">
                      Starts at Group {selectedGroup.groupOrder}
                      {selectedGroup.stages.length > 1 && ` (${selectedGroup.stages.length} stages run together)`}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {selectedGroup.stages.map((s) => {
                        const due = dueFor(s);
                        const late = due != null && due < today;
                        return (
                          <li key={s.stageCode} className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <span className="text-gray-800">
                              {s.displayName} <span className="text-gray-500">· {s.responsibleDepartment}</span>
                            </span>
                            <span className={`text-xs ${late ? "text-red-600 font-medium" : "text-gray-600"}`}>
                              {due ? `Due ${prettyDate(due)}${late ? " (already late)" : ""}` : "No due date yet"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-2 text-xs text-gray-600">
                      {skippedStages.length === 0 ? (
                        "Nothing will be skipped — this is the very first group."
                      ) : (
                        <>
                          {skippedStages.length} earlier stage(s) will be marked done.{" "}
                          <button
                            type="button"
                            onClick={() => setShowSkipped((v) => !v)}
                            className="text-blue-700 font-medium hover:underline"
                          >
                            {showSkipped ? "Hide" : "Show"} list
                          </button>
                        </>
                      )}
                    </p>
                    {showSkipped && skippedStages.length > 0 && (
                      <ul className="mt-2 max-h-40 overflow-y-auto rounded border border-blue-100 bg-white p-2 text-xs text-gray-600 space-y-0.5">
                        {skippedStages.map((s) => (
                          <li key={s.stageCode}>
                            <span className="text-gray-400">G{s.groupOrder}</span> · {s.displayName}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Due date mode */}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label
                    className={`flex gap-2 rounded-lg border p-3 cursor-pointer text-sm ${
                      scheduleMode === "FROM_TODAY" ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduleMode"
                      className="mt-0.5"
                      checked={scheduleMode === "FROM_TODAY"}
                      onChange={() => setScheduleMode("FROM_TODAY")}
                    />
                    <span>
                      <span className="font-medium text-gray-900">Start the timeline from today</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Recommended. The selected stage gets fresh due dates, so nothing is late on day one.
                      </span>
                    </span>
                  </label>
                  <label
                    className={`flex gap-2 rounded-lg border p-3 cursor-pointer text-sm ${
                      scheduleMode === "FROM_ORIGINAL_START" ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduleMode"
                      className="mt-0.5"
                      checked={scheduleMode === "FROM_ORIGINAL_START"}
                      onChange={() => setScheduleMode("FROM_ORIGINAL_START")}
                    />
                    <span>
                      <span className="font-medium text-gray-900">Use the original start date</span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        Due dates count from the real Day 1. Stages past their date will be flagged late tonight.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>
                      Original start date {scheduleMode === "FROM_ORIGINAL_START" ? "*" : "(optional, for record)"}
                    </label>
                    <input
                      type="date"
                      max={today}
                      value={originalStartDate}
                      onChange={(e) => setOriginalStartDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  {needsAuditDate && (
                    <div>
                      <label className={labelCls}>
                        {auditCompleteSkipped ? "Audit completed on" : "Audit visit date"} (optional)
                      </label>
                      <input
                        type="date"
                        value={auditDate}
                        onChange={(e) => setAuditDate(e.target.value)}
                        className={inputCls}
                      />
                      <p className="text-[11px] text-gray-500 mt-1">
                        Sets the due dates of the post-audit stages. Leave blank to set them later.
                      </p>
                    </div>
                  )}
                </div>

                {activeLateCount > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    {activeLateCount} stage(s) in this group are already past their due date. Tonight's late check will
                    flag them and lock access until Admin reauthorizes. Pick “Start the timeline from today” to avoid this.
                  </div>
                )}
              </section>

              {/* ── 2. Client & project ─────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">2. Client &amp; project</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Company name *</label>
                    <input required value={form.companyName} onChange={set("companyName")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Certification</label>
                    {certTypes.length > 0 ? (
                      <select value={form.certificationType} onChange={set("certificationType")} className={inputCls}>
                        <option value="">— Select —</option>
                        {certTypes.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input value={form.certificationType} onChange={set("certificationType")} placeholder="e.g. ISI" className={inputCls} />
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Project name</label>
                    <input
                      value={form.projectName}
                      onChange={set("projectName")}
                      placeholder={
                        form.companyName
                          ? `${form.certificationType ? form.certificationType + " - " : ""}${form.companyName}`
                          : "Defaults to “Certification - Company”"
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Contact person</label>
                    <input value={form.contactName} onChange={set("contactName")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input value={form.phone} onChange={set("phone")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input type="email" value={form.email} onChange={set("email")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>GST number</label>
                    <input value={form.gstNumber} onChange={set("gstNumber")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Project amount (₹)</label>
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Deadline</label>
                    <input type="date" value={form.deadline} onChange={set("deadline")} className={inputCls} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Billing address</label>
                    <input value={form.billingAddress} onChange={set("billingAddress")} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>City</label>
                    <input value={form.city} onChange={set("city")} className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>State</label>
                      <input value={form.state} onChange={set("state")} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Pincode</label>
                      <input value={form.pincode} onChange={set("pincode")} className={inputCls} />
                    </div>
                  </div>
                </div>
              </section>

              {/* ── 3. Team ─────────────────────────────────────────────── */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">3. Team</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Engineer</label>
                    <select value={form.engineerId} onChange={set("engineerId")} className={inputCls}>
                      <option value="">— Select —</option>
                      {engineers.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Ops person</label>
                    <select value={form.opsPersonId} onChange={set("opsPersonId")} className={inputCls}>
                      <option value="">— Select —</option>
                      {users.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Sales owner</label>
                    <select value={form.ownerId} onChange={set("ownerId")} className={inputCls}>
                      <option value="">— Select —</option>
                      {salesUsers.map((u) => <option key={u.id} value={u.id}>{userLabel(u)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Department</label>
                    <select value={form.departmentId} onChange={set("departmentId")} className={inputCls}>
                      <option value="">— Select —</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Notes</label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={set("notes")}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex items-center justify-between gap-3">
              <div className="text-sm text-red-600 min-h-[1.25rem]">{error}</div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? "Adding…" : "Add Project"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}