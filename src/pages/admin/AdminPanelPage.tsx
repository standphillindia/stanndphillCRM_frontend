// src/pages/admin/AdminPanelPage.tsx
// Standphill CRM — Admin Panel
// Frontend-only for now: adminService.ts uses mock data internally.
// Once backend admin endpoints are ready, only src/services/adminService.ts
// needs to change (flip USE_MOCK_DATA to false).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

type Tab = "company" | "lookup" | "system" | "activity" | "users";

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

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "company",  label: "Company",         icon: "domain" },
  { key: "lookup",   label: "Lookup Data",     icon: "list_alt" },
  { key: "system",   label: "System Config",   icon: "settings" },
  { key: "activity", label: "Activity Log",    icon: "history" },
  { key: "users",    label: "Users & Roles",   icon: "group" },
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
    </div>
  );
}