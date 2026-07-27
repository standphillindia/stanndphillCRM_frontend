// src/pages/admin/AdminPanelPage.tsx
// Standphill CRM — Admin Panel
// Frontend-only for now: adminService.ts uses mock data internally.
// Once backend admin endpoints are ready, only src/services/adminService.ts
// needs to change (flip USE_MOCK_DATA to false).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  fetchDelayedProjects,
  fetchProjectStages,
  fetchEngineerVisits,
  reauthorizeStageAccess,
  parseEngineerVisitState,
  resolveFileUrl,
  type StageTrackerResponse,
} from "../../services/projectStageService";
import {
  fetchCompanySettings,
  updateCompanySettings,
  fetchLookupData,
  addLookupItem,
  removeLookupItem,
  fetchSystemConfig,
  updateSystemConfig,
  fetchActivityLog,
  ACTIVITY_MODULES,
  type CompanySettings,
  type LookupData,
  type SystemConfig,
  type ActivityLogEntry,
  type ActivityLogFilters,
} from "../../services/adminService";
import { fetchUsers, type UserResponse } from "../../services/userService";
import {
  fetchReadyToWonLeads,
  transitionLead,
  type ReadyToWonLeadResponse,
} from "../../services/leadService";
import { fetchDepartments, type OrgSetupOption } from "../../services/orgsetupservice";

type Tab = "company" | "lookup" | "system" | "activity" | "users" | "delayed" | "readytowon" | "engineervisits";

const inputCls =
  "w-full px-3 py-2.5 bg-surface border border-outline-variant/30 rounded-lg " +
  "text-body-md text-on-surface outline-none " +
  "focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function SaveBar({
  dirty, saving, saved, onSave,
}: { dirty: boolean; saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-body-sm text-secondary">
        {dirty ? "You have unsaved changes." : "No unsaved changes."}
      </p>
      <button
        onClick={onSave}
        disabled={!dirty || saving}
        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
          rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <span className="material-symbols-outlined text-[16px]">check</span>
            Saved
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[16px]">save</span>
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}

// ── Company tab ────────────────────────────────────────────────────────────────

function CompanyTab() {
  const [form, setForm] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchCompanySettings().then((d) => { setForm(d); setLoading(false); });
  }, []);

  const update = (key: keyof CompanySettings, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true); setSaved(false);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateCompanySettings(form);
      setDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  if (loading || !form) {
    return <div className="glass-card rounded-xl p-10 text-center text-body-md text-secondary animate-pulse">Loading…</div>;
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-headline-md font-semibold text-on-surface mb-1">Company Details</h3>
        <p className="text-body-sm text-secondary">Used on invoices, certificates, and official documents.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Company Name" icon="domain"><input value={form.name} onChange={(e) => update("name", e.target.value)} className={inputCls} /></Field>
        <Field label="GST Number" icon="receipt_long"><input value={form.gst} onChange={(e) => update("gst", e.target.value)} className={inputCls} /></Field>
        <Field label="PAN Number" icon="badge"><input value={form.pan} onChange={(e) => update("pan", e.target.value)} className={inputCls} /></Field>
        <Field label="Email" icon="mail"><input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputCls} /></Field>
        <Field label="Phone" icon="call"><input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Address" icon="location_on">
        <textarea value={form.address} onChange={(e) => update("address", e.target.value)} rows={2} className={`${inputCls} resize-none`} />
      </Field>

      <div className="pt-4 border-t border-outline-variant/10">
        <h3 className="text-headline-md font-semibold text-on-surface mb-1">Bank Details</h3>
        <p className="text-body-sm text-secondary mb-4">Shown on invoices for payment collection.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Bank Name" icon="account_balance"><input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} className={inputCls} /></Field>
          <Field label="Account Holder" icon="person"><input value={form.accountHolder} onChange={(e) => update("accountHolder", e.target.value)} className={inputCls} /></Field>
          <Field label="Account Number" icon="pin"><input value={form.accountNo} onChange={(e) => update("accountNo", e.target.value)} className={inputCls} /></Field>
          <Field label="IFSC Code" icon="tag"><input value={form.ifscCode} onChange={(e) => update("ifscCode", e.target.value)} className={inputCls} /></Field>
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={handleSave} />
    </div>
  );
}

// ── Lookup Data tab ───────────────────────────────────────────────────────────

function LookupListEditor({
  title, icon, items, onAdd, onRemove,
}: {
  title: string;
  icon: string;
  items: { id: string; value: string }[];
  onAdd: (value: string) => void;
  onRemove: (id: string) => void;
}) {
  const [newValue, setNewValue] = useState("");
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!newValue.trim()) return;
    setBusy(true);
    try { await onAdd(newValue.trim()); setNewValue(""); } finally { setBusy(false); }
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
        <h4 className="text-body-lg font-semibold text-on-surface">{title}</h4>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-body-sm font-medium
              bg-surface-container-low border border-outline-variant/20 text-on-surface"
          >
            {item.value}
            <button
              onClick={() => onRemove(item.id)}
              className="p-0.5 rounded-full hover:bg-error/10 hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </span>
        ))}
        {items.length === 0 && <p className="text-body-sm text-secondary">No items yet.</p>}
      </div>
      <div className="flex gap-2">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={`Add new ${title.toLowerCase()}…`}
          className={inputCls}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !newValue.trim()}
          className="px-4 py-2.5 bg-primary text-on-primary rounded-lg text-body-sm font-semibold
            hover:opacity-90 disabled:opacity-50 transition-all shrink-0"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function LookupTab() {
  const [data, setData] = useState<LookupData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => fetchLookupData().then((d) => { setData(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleAdd = async (category: "leadSources" | "certificationTypes", value: string) => {
    await addLookupItem(category, value);
    load();
  };
  const handleRemove = async (category: "leadSources" | "certificationTypes", id: string) => {
    await removeLookupItem(category, id);
    load();
  };

  if (loading || !data) {
    return <div className="glass-card rounded-xl p-10 text-center text-body-md text-secondary animate-pulse">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <LookupListEditor
        title="Lead Sources"
        icon="hub"
        items={data.leadSources}
        onAdd={(v) => handleAdd("leadSources", v)}
        onRemove={(id) => handleRemove("leadSources", id)}
      />
      <LookupListEditor
        title="Certification Types"
        icon="verified"
        items={data.certificationTypes}
        onAdd={(v) => handleAdd("certificationTypes", v)}
        onRemove={(id) => handleRemove("certificationTypes", id)}
      />
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px] text-primary">percent</span>
          <h4 className="text-body-lg font-semibold text-on-surface">GST Rates</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.gstRates.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-body-sm font-semibold
                bg-primary/10 text-primary border border-primary/20"
            >
              {r.value}%
            </span>
          ))}
        </div>
        <p className="text-body-sm text-secondary mt-3">
          GST rates are used across invoices. Edit these in code (leadConstants.ts) once the backend endpoint is ready — kept read-only here for now to avoid invoice mismatches.
        </p>
      </div>
    </div>
  );
}

// ── System Config tab ─────────────────────────────────────────────────────────

function SystemConfigTab() {
  const [form, setForm] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSystemConfig().then((d) => { setForm(d); setLoading(false); });
  }, []);

  const update = <K extends keyof SystemConfig>(key: K, value: SystemConfig[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setDirty(true); setSaved(false);
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await updateSystemConfig(form);
      setDirty(false); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  if (loading || !form) {
    return <div className="glass-card rounded-xl p-10 text-center text-body-md text-secondary animate-pulse">Loading…</div>;
  }

  const previewInvoiceNo = `${form.invoicePrefix}-${form.invoiceStartNumber}`;

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div>
        <h3 className="text-headline-md font-semibold text-on-surface mb-1">Invoice Numbering</h3>
        <p className="text-body-sm text-secondary">Controls how new invoice numbers are generated.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Prefix" icon="tag">
          <input value={form.invoicePrefix} onChange={(e) => update("invoicePrefix", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Next Number" icon="pin">
          <input
            type="number"
            value={form.invoiceStartNumber}
            onChange={(e) => update("invoiceStartNumber", Number(e.target.value))}
            className={inputCls}
          />
        </Field>
      </div>
      <p className="text-body-sm text-secondary">
        Next invoice will be numbered: <span className="font-semibold text-on-surface">{previewInvoiceNo}</span>
      </p>

      <div className="pt-4 border-t border-outline-variant/10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Default Currency" icon="currency_rupee">
          <select value={form.defaultCurrency} onChange={(e) => update("defaultCurrency", e.target.value)} className={inputCls}>
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </Field>
        <Field label="Date Format" icon="calendar_today">
          <select value={form.dateFormat} onChange={(e) => update("dateFormat", e.target.value)} className={inputCls}>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
          </select>
        </Field>
      </div>

      <div className="pt-4 border-t border-outline-variant/10">
        <h3 className="text-headline-md font-semibold text-on-surface mb-3">Notifications</h3>
        <div className="space-y-3">
          {[
            { key: "notifyOnNewLead" as const,             label: "Notify on new lead created" },
            { key: "notifyOnPaymentReceived" as const,     label: "Notify when a payment is received" },
            { key: "notifyOnCertificateExpiry" as const,   label: "Notify before a certificate expires" },
          ].map((opt) => (
            <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form[opt.key]}
                onChange={(e) => update(opt.key, e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant/40 text-primary focus:ring-2 focus:ring-primary/30 cursor-pointer"
              />
              <span className="text-body-md text-on-surface">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <SaveBar dirty={dirty} saving={saving} saved={saved} onSave={handleSave} />
    </div>
  );
}

// ── Activity Log tab ──────────────────────────────────────────────────────────

const MODULE_ICON: Record<string, string> = {
  Admin: "admin_panel_settings",
  Leads: "person_search",
  Deals: "handshake",
  Projects: "engineering",
  AMC: "shield",
  Users: "group",
  Documents: "description",
  Certifications: "verified",
};

const PAGE_SIZE = 25;

function ActivityLogTab() {
  const [entries, setEntries]   = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filter dropdown data
  const [users, setUsers] = useState<UserResponse[]>([]);

  // Filter state
  const [module, setModule]           = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [from, setFrom]               = useState("");
  const [to, setTo]                   = useState("");
  const [search, setSearch]           = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Pagination state
  const [page, setPage]             = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const hasActiveFilters = !!(module || performedBy || from || to || search);

  // Load users once, for the "user" filter dropdown
  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => {});
  }, []);

  // Reset to page 0 whenever a filter changes
  useEffect(() => {
    setPage(0);
  }, [module, performedBy, from, to, search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPageError(null);

    const filters: ActivityLogFilters = {
      module: module || undefined,
      performedBy: performedBy || undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      page,
      size: PAGE_SIZE,
    };

    fetchActivityLog(filters)
      .then((res) => {
        if (cancelled) return;
        setEntries(res.content);
        setTotalPages(res.totalPages);
        setTotalElements(res.totalElements);
      })
      .catch(() => !cancelled && setPageError("Couldn't load the activity log."))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [module, performedBy, from, to, search, page]);

  const clearFilters = () => {
    setModule(""); setPerformedBy(""); setFrom(""); setTo(""); setSearch("");
  };

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actions…"
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30
              rounded-lg text-body-md text-on-surface outline-none
              focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="md:col-span-8 flex flex-wrap items-center gap-3">
          <div
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
              border text-body-sm font-semibold transition-colors
              ${showFilters
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container"
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters{hasActiveFilters ? " (active)" : ""}
          </div>

          {showFilters && (
            <>
              <select
                value={module}
                onChange={(e) => setModule(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="">All Modules</option>
                {ACTIVITY_MODULES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              <select
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName}</option>
                ))}
              </select>

              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <span className="text-body-sm text-secondary">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-body-sm text-error hover:underline"
                >
                  Clear filters
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {pageError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-error-container/40
          border border-error/20 rounded-lg text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {pageError}
        </div>
      )}

      {/* Results */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-body-md text-secondary animate-pulse">Loading…</div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-6 py-4">
                <span className="material-symbols-outlined text-[18px] text-primary mt-0.5">
                  {MODULE_ICON[e.module] ?? "history"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-md text-on-surface">
                    <span className="font-semibold">{e.user}</span> — {e.action}
                  </p>
                  <p className="text-[11px] text-outline mt-0.5">
                    {e.module} · {new Date(e.timestamp).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ))}
            {entries.length === 0 && (
              <p className="text-body-sm text-secondary text-center py-10">
                {hasActiveFilters ? "No activity matches these filters." : "No activity recorded yet."}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-body-sm text-secondary">
            Page {page + 1} of {totalPages} · {totalElements} total
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 rounded-lg text-body-sm font-semibold border border-outline-variant/20
                bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-surface-container transition-colors"
            >
              Previous
            </button>
            <button
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg text-body-sm font-semibold border border-outline-variant/20
                bg-surface-container-low disabled:opacity-40 disabled:cursor-not-allowed
                hover:bg-surface-container transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Delayed Projects tab — LATE stage tracker rows + OPS reauthorize ──────────

interface DelayedProjectLite {
  id: string;
  projectName: string;
  isDelayed: boolean;
  stage: string;
}

function DelayedProjectsTab() {
  const [projects, setProjects] = useState<DelayedProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stagesByProject, setStagesByProject] = useState<Record<string, StageTrackerResponse[]>>({});
  const [busyStageId, setBusyStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchDelayedProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
      setError("Could not load delayed projects.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleExpand = async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);
    if (!stagesByProject[projectId]) {
      try {
        const stages = await fetchProjectStages(projectId);
        setStagesByProject((prev) => ({ ...prev, [projectId]: stages }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleReauthorize = async (projectId: string, stageCode: string) => {
    const reason = window.prompt("Reason for reauthorizing Operations access (optional):") ?? undefined;
    setBusyStageId(stageCode);
    try {
      await reauthorizeStageAccess(projectId, stageCode, { reason });
      const stages = await fetchProjectStages(projectId);
      setStagesByProject((prev) => ({ ...prev, [projectId]: stages }));
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      alert(err?.response?.data?.message ?? err?.message ?? "Could not reauthorize.");
    } finally {
      setBusyStageId(null);
    }
  };

  if (loading) return <div className="glass-card rounded-xl p-8 text-center text-secondary">Loading delayed projects…</div>;

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-outline-variant/20">
        <h3 className="text-headline-md font-semibold text-on-surface">Delayed Projects</h3>
        <p className="text-body-md text-secondary mt-1">
          Projects with at least one LATE stage. Expand to see which stage is late and reauthorize Operations if it's locked.
        </p>
      </div>

      {error && <div className="px-6 py-3 text-error text-body-sm">{error}</div>}

      {projects.length === 0 ? (
        <div className="p-10 text-center text-secondary">No delayed projects right now. 🎉</div>
      ) : (
        <div className="divide-y divide-outline-variant/10">
          {projects.map((p) => (
            <div key={p.id}>
              <button
                onClick={() => toggleExpand(p.id)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-error-container/10 transition-colors text-left"
              >
                <div>
                  <p className="font-semibold text-on-surface">{p.projectName}</p>
                  <p className="text-body-sm text-secondary">Stage: {p.stage}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-[11px] font-bold uppercase bg-error/10 text-error">
                  Delayed
                </span>
              </button>

              {expandedId === p.id && (
                <div className="px-6 pb-4 space-y-2">
                  {(stagesByProject[p.id] ?? [])
                    .filter((s) => s.status === "LATE")
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-error/20 bg-error-container/10 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium text-on-surface">{s.displayName}</p>
                          <p className="text-body-sm text-secondary">
                            {s.responsibleDepartment} · Due {s.dueDate ?? "—"}
                            {s.daysLateOrRemaining !== null && (
                              <span className="text-error font-medium"> · {Math.abs(s.daysLateOrRemaining)} day(s) late</span>
                            )}
                          </p>
                        </div>
                        {s.accessLocked ? (
                          <button
                            disabled={busyStageId === s.stageCode}
                            onClick={() => handleReauthorize(p.id, s.stageCode)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-error hover:opacity-90 disabled:opacity-50"
                          >
                            {busyStageId === s.stageCode ? "Reauthorizing…" : "🔓 Reauthorize Ops"}
                          </button>
                        ) : (
                          <span className="text-body-sm text-secondary">Not locked ({s.responsibleDepartment})</span>
                        )}
                      </div>
                    ))}
                  {(stagesByProject[p.id] ?? []).filter((s) => s.status === "LATE").length === 0 && (
                    <p className="text-body-sm text-secondary">Loading stage details…</p>
                  )}
                  <Link to={`/projects/${p.id}/stages`} className="inline-block text-body-sm text-primary hover:underline mt-1">
                    View full timeline →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Users & Roles shortcut tab ────────────────────────────────────────────────

function UsersShortcutTab() {
  return (
    <div className="glass-card rounded-xl p-8 text-center">
      <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-[28px] text-primary">group</span>
      </div>
      <h3 className="text-headline-md font-semibold text-on-surface mb-2">Users & Roles</h3>
      <p className="text-body-md text-secondary mb-6 max-w-md mx-auto">
        Team members, roles, and RBAC permissions are managed on the Users page.
      </p>
      <Link
        to="/users"
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
          rounded-lg text-body-md font-semibold hover:opacity-90 transition-all"
      >
        Go to Users
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </Link>
    </div>
  );
}

// ── Engineer Visits tab — Admin gallery of every factory-visit photo ─────
// Pulls every CLIENT_VISIT_ENG stage tracker across all projects (backend:
// GET /api/admin/engineer-visits) so Admin can review uploaded photos —
// scheduled, completed (with photo), or failed — without opening each
// project's stage page individually. The photoUrl/visitStatus/notes live
// inside the tracker's `validationData` JSON blob (parseEngineerVisitState).
function EngineerVisitsTab() {
  const [visits, setVisits] = useState<StageTrackerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setVisits(await fetchEngineerVisits());
      } catch (e) {
        console.error(e);
        setError("Could not load engineer visits.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statusStyle: Record<string, string> = {
    SCHEDULED: "bg-amber-100 text-amber-800",
    COMPLETED: "bg-emerald-100 text-emerald-800",
    FAILED: "bg-red-100 text-red-800",
  };

  if (loading) return <div className="glass-card rounded-xl p-8 text-center text-secondary">Loading engineer visits…</div>;

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-outline-variant/20">
        <h3 className="text-headline-md font-semibold text-on-surface">Engineer Visits</h3>
        <p className="text-body-md text-secondary mt-1">
          Factory-visit photos uploaded by Engineering, across every project — newest first.
        </p>
      </div>

      {error && <div className="px-6 py-3 text-error text-body-sm">{error}</div>}

      {visits.length === 0 ? (
        <div className="p-10 text-center text-secondary">No engineer visits logged yet.</div>
      ) : (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visits.map((v) => {
            const state = parseEngineerVisitState(v.validationData);
            const photoUrl = resolveFileUrl(state.photoUrl);
            return (
              <div key={v.id} className="border border-outline-variant/20 rounded-xl overflow-hidden bg-white">
                <button
                  type="button"
                  onClick={() => photoUrl && setLightboxUrl(photoUrl)}
                  className="w-full h-40 bg-surface-container-low flex items-center justify-center overflow-hidden"
                  disabled={!photoUrl}
                >
                  {photoUrl ? (
                    <img src={photoUrl} alt={`${v.projectName} visit`} className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  ) : (
                    <span className="text-[12px] text-secondary">No photo</span>
                  )}
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-body-md font-semibold text-on-surface">{v.projectName}</p>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusStyle[state.visitStatus ?? ""] ?? "bg-surface-container-low text-secondary"}`}>
                      {state.visitStatus ?? "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-outline mt-1">
                    Visit date: {state.visitDate ?? "—"}
                  </p>
                  {v.completedByName && (
                    <p className="text-[11px] text-outline">
                      Logged by {v.completedByName}{v.completedAt ? ` · ${new Date(v.completedAt).toLocaleDateString("en-IN")}` : ""}
                    </p>
                  )}
                  {state.notes && (
                    <p className="text-body-sm text-secondary mt-2">{state.notes}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Photo lightbox — portal to document.body (see Ready-to-Won
          modal fix above: .glass-card's backdrop-filter + overflow-hidden
          would otherwise clip/mispositon a `fixed` element rendered
          inside it). ──────────────────────────────────────────────── */}
      {lightboxUrl && createPortal(
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Engineer visit full size" className="max-w-full max-h-full rounded-lg shadow-2xl" />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/90 hover:bg-white"
          >
            <span className="material-symbols-outlined text-[20px] text-on-surface">close</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Ready to Won tab — Admin approval step of the pre-WON finance flow ────────
// Every lead here has its PI fully paid and its TI generated (both enforced
// by the backend). Admin verifies PI + TI + final amount, assigns the Ops
// person + Engineer (+ department), and presses WON — that single click
// creates the Project (DRAFT) and starts the 45-day stage tracker at Day 1.

function ReadyToWonTab() {
  const [rows, setRows] = useState<ReadyToWonLeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal
  const [reviewLead, setReviewLead] = useState<ReadyToWonLeadResponse | null>(null);
  const [form, setForm] = useState({
    amount: "",
    expectedCloseDate: "",
    notes: "",
    assignedEngineerId: "",
    departmentId: "",
    opsPersonId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [engineers, setEngineers] = useState<UserResponse[]>([]);
  const [allUsers, setAllUsers] = useState<UserResponse[]>([]);
  const [departments, setDepartments] = useState<OrgSetupOption[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchReadyToWonLeads());
    } catch (e) {
      console.error(e);
      setError("Could not load Ready-to-Won leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    fetchUsers({ role: "ENGINEER" }).then(setEngineers).catch(() => setEngineers([]));
    fetchUsers({}).then(setAllUsers).catch(() => setAllUsers([]));
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const openReview = (lead: ReadyToWonLeadResponse) => {
    setReviewLead(lead);
    setForm({
      // Final amount prefills from the PI total — Admin can adjust.
      amount: lead.piTotal != null ? String(lead.piTotal) : "",
      expectedCloseDate: "",
      notes: "",
      assignedEngineerId: "",
      departmentId: "",
      opsPersonId: "",
    });
    setSubmitError(null);
  };

  const handleWon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewLead) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await transitionLead(reviewLead.leadId, {
        targetStatus: "WON",
        amount: form.amount ? Number(form.amount) : undefined,
        expectedCloseDate: form.expectedCloseDate || undefined,
        notes: form.notes || undefined,
        assignedEngineerId: form.assignedEngineerId || undefined,
        departmentId: form.departmentId || undefined,
        opsPersonId: form.opsPersonId || undefined,
      });
      setReviewLead(null);
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setSubmitError(err?.response?.data?.message ?? err?.message ?? "Failed to mark WON.");
    } finally {
      setSubmitting(false);
    }
  };

  const inr = (n?: number) =>
    n == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  if (loading) return <div className="glass-card rounded-xl p-8 text-center text-secondary">Loading Ready-to-Won leads…</div>;

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-outline-variant/20">
        <h3 className="text-headline-md font-semibold text-on-surface">Ready to Won</h3>
        <p className="text-body-md text-secondary mt-1">
          Leads with the PI fully paid and the TI generated. Verify the numbers, assign the Ops person
          &amp; Engineer, then press WON — the project starts at Day&nbsp;1 of the 45-day tracker.
        </p>
      </div>

      {error && <div className="px-6 py-3 text-error text-body-sm">{error}</div>}

      {rows.length === 0 ? (
        <div className="p-10 text-center text-secondary">Nothing waiting for approval right now. 🎉</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-[11px] uppercase tracking-wide text-secondary">
              <tr>
                <th className="px-6 py-3">Lead</th>
                <th className="px-6 py-3">Certification</th>
                <th className="px-6 py-3">Sales Owner</th>
                <th className="px-6 py-3">PI</th>
                <th className="px-6 py-3">Paid</th>
                <th className="px-6 py-3">TI</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {rows.map((r) => (
                <tr key={r.leadId} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-body-md font-semibold text-on-surface">{r.companyName}</p>
                    <p className="text-[11px] text-outline mt-0.5">{r.contactName} · {r.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-body-md text-secondary">{r.certificationType || r.product || "—"}</td>
                  <td className="px-6 py-4 text-body-md text-secondary">{r.assignedToEmail}</td>
                  <td className="px-6 py-4">
                    <p className="text-body-sm font-medium text-on-surface">{r.piNumber || "—"}</p>
                    <p className="text-[11px] text-outline">{inr(r.piTotal)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-body-sm font-semibold ${r.piPaymentStatus === "PAID" ? "text-green-700" : "text-amber-700"}`}>
                      {inr(r.piPaid)}
                    </span>
                    <p className="text-[11px] text-outline">{r.piPaymentStatus || "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-body-sm font-medium text-on-surface">{r.tiNumber || "—"}</p>
                    <p className="text-[11px] text-outline">{r.tiIssueDate ? new Date(r.tiIssueDate).toLocaleDateString("en-IN") : ""}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openReview(r)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-body-sm font-semibold hover:bg-emerald-700 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      Review &amp; WON
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Review & WON modal ─────────────────────────────────────────────
          Rendered via a portal into document.body. The .glass-card ancestor
          above uses backdrop-filter + overflow-hidden, and backdrop-filter
          creates a new CSS containing block for `position: fixed`
          descendants — without the portal, this modal would be positioned/
          clipped relative to that card instead of the viewport, which is
          why it used to render cut off / half-visible. ────────────────── */}
      {reviewLead && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-outline-variant/20 flex items-start justify-between">
              <div>
                <h3 className="text-headline-md font-semibold text-on-surface">Mark WON — {reviewLead.companyName}</h3>
                <p className="text-body-sm text-secondary mt-1">
                  PI {reviewLead.piNumber} · {inr(reviewLead.piTotal)} paid ({reviewLead.piPaymentStatus}) · TI {reviewLead.tiNumber}
                </p>
                <Link
                  to={`/payments/lead/${reviewLead.leadId}`}
                  className="text-body-sm text-primary font-medium hover:underline inline-block mt-1"
                >
                  View PI/TI payment history →
                </Link>
              </div>
              <button onClick={() => setReviewLead(null)} className="p-1 rounded hover:bg-surface-container-low">
                <span className="material-symbols-outlined text-[20px] text-secondary">close</span>
              </button>
            </div>

            <form onSubmit={handleWon} className="p-5 space-y-4">
              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-body-sm">⚠️ {submitError}</div>
              )}

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Final Project Amount (₹) *</label>
                <input
                  type="number" required min="0" step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="text-[11px] text-outline mt-1">Prefilled from the PI total — adjust if the project value differs.</p>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Expected Close / Deadline</label>
                <input
                  type="date"
                  value={form.expectedCloseDate}
                  onChange={(e) => setForm((p) => ({ ...p, expectedCloseDate: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Ops Person *</label>
                <select
                  required
                  value={form.opsPersonId}
                  onChange={(e) => setForm((p) => ({ ...p, opsPersonId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Select —</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Engineer *</label>
                <select
                  required
                  value={form.assignedEngineerId}
                  onChange={(e) => setForm((p) => ({ ...p, assignedEngineerId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Select —</option>
                  {engineers.map((u) => (
                    <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Department</label>
                <select
                  value={form.departmentId}
                  onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Assign later —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-body-sm font-medium text-secondary mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:bg-gray-400 transition-colors"
                >
                  {submitting ? "Marking WON…" : "Confirm WON — Start Project (Day 1)"}
                </button>
                <button
                  type="button"
                  onClick={() => setReviewLead(null)}
                  className="px-5 h-11 rounded-xl bg-surface-container-low text-secondary font-medium hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "company",  label: "Company",         icon: "domain" },
  { key: "lookup",   label: "Lookup Data",     icon: "list_alt" },
  { key: "system",   label: "System Config",   icon: "settings" },
  { key: "activity", label: "Activity Log",    icon: "history" },
  { key: "users",    label: "Users & Roles",   icon: "group" },
  { key: "delayed",  label: "Delayed Projects", icon: "warning" },
  { key: "readytowon", label: "Ready to Won", icon: "verified" },
  { key: "engineervisits", label: "Engineer Visits", icon: "photo_camera" },
];

export default function AdminPanelPage() {
  const [activeTab, setActiveTab] = useState<Tab>("company");

  return (
    <div className="max-w-[1100px] mx-auto space-y-6">
      <div>
        <h3 className="text-headline-lg font-semibold text-on-surface">Admin Panel</h3>
        <p className="text-body-md text-secondary mt-0.5">System-wide settings and configuration.</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-outline-variant/20">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-body-sm font-semibold border-b-2 -mb-px transition-colors
              ${activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-on-surface"
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "company"  && <CompanyTab />}
      {activeTab === "lookup"   && <LookupTab />}
      {activeTab === "system"   && <SystemConfigTab />}
      {activeTab === "activity" && <ActivityLogTab />}
      {activeTab === "users"    && <UsersShortcutTab />}
      {activeTab === "delayed"  && <DelayedProjectsTab />}
      {activeTab === "readytowon" && <ReadyToWonTab />}
      {activeTab === "engineervisits" && <EngineerVisitsTab />}
    </div>
  );
}