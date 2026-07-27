// src/pages/leads/LeadsPage.tsx
// Standphill CRM — Leads page
// UI fully rebuilt to match the Standphill design system.
// All API calls, logic, and state are preserved exactly from the original.

import { useEffect, useState, useMemo } from "react";
import {
  fetchLeads,
  createLead,
  updateLead,
  deleteLead,
  transitionLead,
  type LeadResponse,
  type CreateLeadRequest,
  type LeadFilterParams,
} from "../../services/leadService";
import { fetchUsers, type UserResponse as OrgUserResponse } from "../../services/userService";
import { fetchDepartments, type DepartmentResponse } from "../../services/orgService";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  type LeadSource,
  type LeadStatus,
} from "../../constants/leadConstants";

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  NEW:         { bg: "bg-primary/10",           text: "text-primary",    border: "border-primary/20",    label: "New"           },
  CONTACTED:   { bg: "bg-tertiary/10",          text: "text-tertiary",   border: "border-tertiary/20",   label: "Contacted"     },
  FOLLOW_UP:   { bg: "bg-orange-500/10",        text: "text-orange-700", border: "border-orange-500/20", label: "Follow Up"     },
  QUALIFIED:   { bg: "bg-green-500/10",         text: "text-green-700",  border: "border-green-500/20",  label: "Qualified"     },
  PROPOSAL:    { bg: "bg-amber-500/10",         text: "text-amber-700",  border: "border-amber-500/20",  label: "Proposal"      },
  NEGOTIATION: { bg: "bg-purple-500/10",        text: "text-purple-700", border: "border-purple-500/20", label: "Negotiation"   },
  PI_RAISED:        { bg: "bg-orange-500/10",  text: "text-orange-700",  border: "border-orange-500/20",  label: "PI Raised"        },
  PAYMENT_RECEIVED: { bg: "bg-teal-500/10",    text: "text-teal-700",    border: "border-teal-500/20",    label: "Payment Received" },
  READY_TO_WON:     { bg: "bg-lime-500/10",    text: "text-lime-700",    border: "border-lime-500/20",    label: "Ready to Won"     },
  WON:         { bg: "bg-emerald-500/10",       text: "text-emerald-700",border: "border-emerald-500/20",label: "Won"           },
  LOST:        { bg: "bg-error/10",             text: "text-error",      border: "border-error/20",      label: "Lost"          },
};

// ── Status transition map (business logic preserved) ─────────────────────────

const getAllowedStatuses = (current: LeadStatus): LeadStatus[] => {
  switch (current) {
    case "NEW":         return ["NEW", "CONTACTED", "LOST"];
    case "CONTACTED":   return ["CONTACTED", "FOLLOW_UP", "QUALIFIED", "LOST"];
    case "FOLLOW_UP":   return ["FOLLOW_UP", "QUALIFIED", "LOST"];
    case "QUALIFIED":   return ["QUALIFIED", "PROPOSAL", "LOST"];
    case "PROPOSAL":    return ["PROPOSAL", "NEGOTIATION", "LOST"];
    case "NEGOTIATION": return ["NEGOTIATION", "PI_RAISED", "LOST"]; // Sales signals Finance to raise the PI
    case "PI_RAISED":        return ["PI_RAISED", "LOST"];
    case "PAYMENT_RECEIVED": return ["PAYMENT_RECEIVED", "READY_TO_WON"]; // Sales confirms once TI is generated
    case "READY_TO_WON":     return ["READY_TO_WON", "LOST"]; // WON stays Admin-only, via the Ready-to-Won review
    case "WON":         return ["WON"];
    case "LOST":        return ["LOST"];
    default:            return ["NEW"];
  }
};

// ── Avatar initials helper ────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "bg-primary/20 text-primary",
  "bg-tertiary/20 text-tertiary",
  "bg-secondary-container text-on-secondary-container",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ── Empty form ────────────────────────────────────────────────────────────────
// NOTE: nextFollowUpDate intentionally NOT included here anymore — follow-up
// dates are set exclusively via the table's status-dropdown -> FOLLOW_UP
// modal, not via manual entry on create.

const EMPTY_FORM: CreateLeadRequest = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  product: "",
  certificationType: "",
  source: "MANUAL",
  assignedToEmail: "",
};

// ── Form field config ─────────────────────────────────────────────────────────
// NOTE: "Next Follow-up Date" field removed from here on purpose — it no
// longer appears in either the New Lead or Edit Lead forms. The table's
// FOLLOW_UP status flow (unchanged) remains the only way to set/update it.

const FORM_FIELDS = [
  { name: "companyName",       label: "Company Name",       type: "text",  placeholder: "ABC Pvt Ltd",          icon: "domain"          },
  { name: "contactName",       label: "Contact Name",       type: "text",  placeholder: "Rahul Sharma",          icon: "person"          },
  { name: "email",             label: "Email",              type: "email", placeholder: "rahul@abc.com",         icon: "mail"            },
  { name: "phone",             label: "Phone",              type: "tel",   placeholder: "9876543210",            icon: "call"            },
  { name: "product",           label: "Product",            type: "text",  placeholder: "ISO 9001",              icon: "inventory_2"     },
  { name: "certificationType", label: "Certification Type", type: "text",  placeholder: "ISO",                   icon: "verified"        },
  { name: "assignedToEmail",   label: "Assign To (Email)", type: "email", placeholder: "admin@standphill.com",  icon: "manage_accounts" },
] as const;

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(8)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-secondary-fixed/60 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Form field component ──────────────────────────────────────────────────────

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
}) {
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

const inputCls =
  "w-full px-3 py-2.5 bg-surface border border-outline-variant/30 rounded-lg " +
  "text-body-md text-on-surface outline-none " +
  "focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {

  // ── WON Modal State ────────────────────────────────────────────────────────
  const [wonLead, setWonLead] = useState<LeadResponse | null>(null);
  const [wonForm, setWonForm] = useState({
    amount: "",
    expectedCloseDate: "",
    notes: "",
    assignedEngineerId: "",
    departmentId: "",
    opsPersonId: "",
  });
  const [wonError, setWonError] = useState<string | null>(null);
  const [wonLoading, setWonLoading] = useState(false);

  // Engineers + departments for the WON modal's dropdowns — loaded once
  // when the page mounts, reused every time the modal opens.
  const [engineers, setEngineers] = useState<OrgUserResponse[]>([]);
  const [departments, setDepartments] = useState<DepartmentResponse[]>([]);
  const [opsUsers, setOpsUsers] = useState<OrgUserResponse[]>([]);

  useEffect(() => {
    fetchUsers({ role: "ENGINEER" }).then(setEngineers).catch(() => setEngineers([]));
    // Ops person dropdown for the WON review — every user works; Admin
    // typically picks someone from Operations.
    fetchUsers({}).then(setOpsUsers).catch(() => setOpsUsers([]));
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  // ── FOLLOW UP Modal State (unchanged — table's status flow) ──────────────
  const [followUpLead, setFollowUpLead] = useState<LeadResponse | null>(null);
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // ── State ──────────────────────────────────────────────────────────────────
  const [leads,         setLeads]         = useState<LeadResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [page,          setPage]          = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [pageError,     setPageError]     = useState<string | null>(null);

  // Filters
  const [search,        setSearch]        = useState("");
  const [statusFilter,  setStatusFilter]  = useState<LeadStatus | "ALL">("ALL");
  const [sourceFilter,  setSourceFilter]  = useState("");
  const [showFilters,   setShowFilters]   = useState(false);

  // Create modal
  const [showAdd,    setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState<CreateLeadRequest>(EMPTY_FORM);
  const [addError,   setAddError]   = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editLead,    setEditLead]    = useState<LeadResponse | null>(null);
  const [editForm,    setEditForm]    = useState<CreateLeadRequest>(EMPTY_FORM);
  const [editError,   setEditError]   = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Status change inline
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadLeads = async (p = page) => {
    setLoading(true);
    setPageError(null);
    try {
      const params: LeadFilterParams = {
        page: p, size: 10, sortBy: "createdAt", sortDir: "desc",
      };
      if (search)                  params.search = search;
      if (statusFilter !== "ALL")  params.status = statusFilter as LeadStatus;
      if (sourceFilter)            params.source = sourceFilter;

      const data = await fetchLeads(params);
      setLeads(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setPageError(err?.response?.data?.message ?? err?.message ?? "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(page); }, [page]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(0); loadLeads(0); }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, sourceFilter]);

  // ── Create ─────────────────────────────────────────────────────────────────
  // NOTE: no longer strips/forwards nextFollowUpDate — the field doesn't
  // exist in this form anymore, so the payload is sent as-is.
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true); setAddError(null);
    try {
      await createLead(addForm);
      setShowAdd(false); setAddForm(EMPTY_FORM); loadLeads(0);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setAddError(err?.response?.data?.message ?? err?.message ?? "Failed to create lead.");
    } finally { setAddLoading(false); }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  // NOTE: nextFollowUpDate is still carried in editForm's internal state
  // (set below, not shown in the form) purely so an existing lead's
  // follow-up date is preserved on save, instead of being silently wiped
  // out by submitting a form that no longer has a field for it.
  const openEdit = (lead: LeadResponse) => {
    setEditLead(lead);
    setEditForm({
      companyName: lead.companyName, contactName: lead.contactName,
      email: lead.email, phone: lead.phone, product: lead.product,
      certificationType: lead.certificationType,
      source: lead.source as LeadSource, assignedToEmail: lead.assignedToEmail,
      nextFollowUpDate: lead.nextFollowUpDate ?? "",
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead) return;
    setEditLoading(true); setEditError(null);
    try {
      await updateLead(editLead.id, { ...editForm, nextFollowUpDate: editForm.nextFollowUpDate || undefined });
      setEditLead(null); loadLeads(page);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setEditError(err?.response?.data?.message ?? err?.message ?? "Failed to update lead.");
    } finally { setEditLoading(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try { await deleteLead(deleteId); setDeleteId(null); loadLeads(page); }
    catch { /* ignore */ }
    finally { setDeleteLoading(false); }
  };

  // ── Status change ──────────────────────────────────────────────────────────
  const handleStatusChange = async (
    id: string,
    status: LeadStatus
  ) => {
    setStatusLoading(id);

    try {
      await transitionLead(id, {
        targetStatus: status,
      });

      loadLeads(page);

    } catch (err) {
      // Without this, a rejected transition (e.g. trying to move to
      // READY_TO_WON before Finance has generated the TI) silently
      // reverted the dropdown with zero feedback — looked like the click
      // "did nothing" when really the backend was correctly blocking it.
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      const reason =
        anyErr?.response?.data?.message ??
        anyErr?.message ??
        "Failed to update status.";
      alert(`⚠️ ${reason}`);
    } finally {
      setStatusLoading(null);
    }
  };

  // ── WON Submit ─────────────────────────────────────────────────────────────
  const handleWonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!wonLead) return;

    setWonLoading(true);
    setWonError(null);

    try {
      await transitionLead(wonLead.id, {
        targetStatus: "WON",
        amount: Number(wonForm.amount),
        expectedCloseDate: wonForm.expectedCloseDate,
        notes: wonForm.notes,
        assignedEngineerId: wonForm.assignedEngineerId || undefined,
        departmentId: wonForm.departmentId || undefined,
        opsPersonId: wonForm.opsPersonId || undefined,
      });

      // Success: close modal and reset
      setWonLead(null);
      setWonForm({ amount: "", expectedCloseDate: "", notes: "", assignedEngineerId: "", departmentId: "", opsPersonId: "" });

      // Reload leads
      loadLeads(page);

    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setWonError(err?.response?.data?.message ?? err?.message ?? "Failed to mark lead as won.");
    } finally {
      setWonLoading(false);
    }
  };

  // ── FOLLOW UP Submit (unchanged — table's status flow) ────────────────────
  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!followUpLead) return;
    if (!followUpDateInput) { setFollowUpError("Please select a follow-up date."); return; }

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      await transitionLead(followUpLead.id, {
        targetStatus: "FOLLOW_UP",
        nextFollowUpDate: followUpDateInput,
      });

      setFollowUpLead(null);
      setFollowUpDateInput("");

      loadLeads(page);

    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFollowUpError(err?.response?.data?.message ?? err?.message ?? "Failed to set follow-up date.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  // ── Pagination ─────────────────────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(0, page - 2);
    const end   = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const pageStart = page * 10 + 1;
  const pageEnd   = Math.min((page + 1) * 10, totalElements);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1440px] mx-auto space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-lg font-semibold text-on-surface">Leads</h3>
          <p className="text-body-md text-secondary mt-0.5">
            {loading ? "Loading…" : `${totalElements} total leads`}
          </p>
        </div>
        <button
          onClick={() => { setAddForm(EMPTY_FORM); setAddError(null); setShowAdd(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
            rounded-lg text-body-md font-semibold shadow-sm
            hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Lead
        </button>
      </div>

      {/* ── Search + filter bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Search */}
        <div className="md:col-span-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads, companies…"
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30
              rounded-lg text-body-md text-on-surface outline-none
              focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        {/* Filter chips */}
        <div className="md:col-span-8 flex flex-wrap items-center gap-3">
          {/* Status filter */}
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
            Status{statusFilter !== "ALL" ? `: ${statusFilter}` : ": All"}
          </div>

          {/* Source filter (shown when filters open) */}
          {showFilters && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "ALL")}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                {LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="">All Sources</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>

              {(statusFilter !== "ALL" || sourceFilter) && (
                <button
                  onClick={() => { setStatusFilter("ALL"); setSourceFilter(""); }}
                  className="text-body-sm text-error hover:underline"
                >
                  Clear filters
                </button>
              )}
            </>
          )}

          <div className="flex-1" />

          {/* Export placeholder */}
          <button className="p-2 border border-outline-variant/30 rounded-lg
            hover:bg-surface-container-high transition-all text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">download</span>
          </button>
          <button className="p-2 border border-outline-variant/30 rounded-lg
            hover:bg-surface-container-high transition-all text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* ── Error bar ──────────────────────────────────────────────────────── */}
      {pageError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-error-container/40
          border border-error/20 rounded-lg text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {pageError}
          <button
            onClick={() => loadLeads(page)}
            className="ml-auto text-body-sm font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                {["Name", "Company", "Status", "Product", "Source", "Date", "Follow-up", "Actions"].map((h, i) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-label-caps text-outline uppercase tracking-wider whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      {h}
                      {i === 0 && (
                        <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center gap-3 py-16 text-secondary">
                      <span
                        className="material-symbols-outlined text-[48px] text-outline"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}
                      >
                        person_search
                      </span>
                      <p className="text-body-md">
                        No leads found.
                        {search || statusFilter !== "ALL" || sourceFilter
                          ? " Try clearing your filters."
                          : ""}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const av    = avatarColor(lead.contactName || lead.companyName);
                  const ini   = initials(lead.contactName || lead.companyName || "?");
                  const date  = lead.createdAt
                    ? new Date(lead.createdAt).toLocaleDateString("en-IN")
                    : "—";

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-primary/[0.02] transition-colors group"
                    >
                      {/* Name + email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center
                              text-[12px] font-bold shrink-0 ${av}`}
                          >
                            {ini}
                          </div>
                          <div>
                            <p className="text-body-md font-semibold text-on-surface leading-tight">
                              {lead.contactName || "—"}
                            </p>
                            <p className="text-[11px] text-outline mt-0.5 leading-tight">
                              {lead.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="px-6 py-4 text-body-md font-medium text-secondary whitespace-nowrap">
                        {lead.companyName || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {statusLoading === lead.id ? (
                          <span className="text-body-sm text-secondary animate-pulse">Updating…</span>
                        ) : (
                          <select
                            value={lead.status}
                            onChange={(e) => {
                              const status = e.target.value as LeadStatus;

                              if (status === "WON") {
                                setWonLead(lead);
                                setWonForm({ amount: "", expectedCloseDate: "", notes: "", assignedEngineerId: "", departmentId: "", opsPersonId: "" });
                                setWonError(null);
                                return;
                              }

                              if (status === "FOLLOW_UP") {
                                setFollowUpLead(lead);
                                setFollowUpDateInput(lead.nextFollowUpDate ?? "");
                                setFollowUpError(null);
                                return;
                              }

                              handleStatusChange(lead.id, status);
                            }}
                            className={`border rounded-full px-3 py-1 text-[11px] font-bold
                              uppercase tracking-tight outline-none cursor-pointer appearance-none
                              transition-all focus:ring-2 focus:ring-primary/20
                              ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).bg}
                              ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).text}
                              ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).border}`}
                          >
                            {getAllowedStatuses(lead.status as LeadStatus).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Product */}
                      <td className="px-6 py-4 text-body-md text-secondary">
                        {lead.product || "—"}
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 text-body-md text-secondary capitalize">
                        {lead.source.toLowerCase().replace(/_/g, " ")}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {date}
                      </td>

                      {/* Follow-up */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.nextFollowUpDate ? (
                          <span
                            className={`text-body-sm font-medium ${
                              lead.nextFollowUpDate === new Date().toISOString().split("T")[0]
                                ? "text-amber-600"
                                : lead.nextFollowUpDate < new Date().toISOString().split("T")[0]
                                ? "text-error"
                                : "text-secondary"
                            }`}
                          >
                            {new Date(lead.nextFollowUpDate).toLocaleDateString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      {/* Actions — appear on row hover */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1
                          opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                            onClick={() => openEdit(lead)}
                            title="Edit"
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteId(lead.id)}
                            title="Delete"
                            className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination footer ──────────────────────────────────────────── */}
        {!loading && totalElements > 0 && (
          <div className="px-6 py-4 flex items-center justify-between
            bg-surface-container-low/50 border-t border-outline-variant/10">
            <p className="text-body-sm text-secondary">
              Showing{" "}
              <span className="font-bold text-on-surface">{pageStart}–{pageEnd}</span>
              {" "}of{" "}
              <span className="font-bold text-on-surface">{totalElements}</span>
              {" "}leads
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="p-2 hover:bg-surface-container rounded-lg disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded text-body-sm font-medium transition-colors ${
                    p === page
                      ? "bg-primary text-on-primary font-bold"
                      : "text-secondary hover:bg-surface-container"
                  }`}
                >
                  {p + 1}
                </button>
              ))}
              <button
                disabled={page === totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="p-2 hover:bg-surface-container rounded-lg disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mini stats bento (from reference design) ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Leads",    value: totalElements, sub: "In pipeline",       color: "text-primary"    },
          { label: "New",            value: leads.filter(l => l.status === "NEW").length,       sub: "This page",  color: "text-tertiary"   },
          { label: "Won",            value: leads.filter(l => l.status === "WON").length,       sub: "This page",  color: "text-green-700"  },
          { label: "Lost",           value: leads.filter(l => l.status === "LOST").length,      sub: "This page",  color: "text-error"      },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4">
            <p className="text-label-caps text-outline uppercase mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className={`text-headline-lg font-bold ${stat.color}`}>{stat.value}</h3>
              <span className="text-body-sm text-secondary mb-0.5">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">New Lead</h2>
              <p className="text-body-sm text-secondary mt-0.5">Fill in the details to create a new lead</p>
            </div>
            <button
              onClick={() => setShowAdd(false)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleAdd} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FORM_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} icon={f.icon}>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    required
                    value={addForm[f.name] ?? ""}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              ))}
              <Field label="Source" icon="hub">
                <select
                  required
                  value={addForm.source}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, source: e.target.value as LeadSource }))}
                  className={inputCls}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {addError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {addError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {addLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Create Lead
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {editLead && (
        <Modal onClose={() => setEditLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">
                Edit Lead
              </h2>
              <p className="text-body-sm text-secondary mt-0.5">{editLead.companyName}</p>
            </div>
            <button
              onClick={() => setEditLead(null)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FORM_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} icon={f.icon}>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    required
                    value={editForm[f.name] ?? ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              ))}
              <Field label="Source" icon="hub">
                <select
                  required
                  value={editForm.source}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, source: e.target.value as LeadSource }))}
                  className={inputCls}
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {editError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setEditLead(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {editLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── WON Modal ─────────────────────────────────────────────────────── */}
      {wonLead && (
        <Modal onClose={() => setWonLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Mark Lead as Won</h2>
              <p className="text-body-sm text-secondary mt-0.5">{wonLead.companyName}</p>
            </div>
            <button
              onClick={() => setWonLead(null)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleWonSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount" icon="currency_rupee">
                <input
                  type="number"
                  placeholder="100000"
                  required
                  min="0"
                  step="0.01"
                  value={wonForm.amount}
                  onChange={(e) => setWonForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Expected Close Date" icon="calendar_today">
                <input
                  type="date"
                  required
                  value={wonForm.expectedCloseDate}
                  onChange={(e) => setWonForm((prev) => ({ ...prev, expectedCloseDate: e.target.value }))}
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Assign Engineer (Optional)" icon="engineering">
                <select
                  value={wonForm.assignedEngineerId}
                  onChange={(e) => setWonForm((prev) => ({ ...prev, assignedEngineerId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Assign later —</option>
                  {engineers.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.fullName} ({eng.email})
                    </option>
                  ))}
                </select>
                {engineers.length === 0 && (
                  <p className="text-xs text-secondary mt-1">No engineers found — add one under Users first.</p>
                )}
              </Field>
              <Field label="Department (Optional)" icon="apartment">
                <select
                  value={wonForm.departmentId}
                  onChange={(e) => setWonForm((prev) => ({ ...prev, departmentId: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Assign later —</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Ops Person (Optional)" icon="support_agent">
                <select
                  value={wonForm.opsPersonId}
                  onChange={(e) => setWonForm((prev) => ({ ...prev, opsPersonId: e.target.value }))}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface text-body-md outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Assign later —</option>
                  {opsUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.email})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <p className="text-xs text-secondary -mt-2">
              Project starts (out of DRAFT) automatically once its first payment lands — engineer and
              department picked here get assigned to the project right away.
            </p>

            <Field label="Notes (Optional)" icon="note">
              <textarea
                placeholder="Add any notes about this deal…"
                value={wonForm.notes}
                onChange={(e) => setWonForm((prev) => ({ ...prev, notes: e.target.value }))}
                className={`${inputCls} resize-none`}
                rows={4}
              />
            </Field>

            {wonError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {wonError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setWonLead(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={wonLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {wonLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Marking Won…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Mark as Won
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── FOLLOW UP Modal (unchanged — table's status flow) ─────────────── */}
      {followUpLead && (
        <Modal onClose={() => setFollowUpLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Set Follow-up Date</h2>
              <p className="text-body-sm text-secondary mt-0.5">{followUpLead.companyName}</p>
            </div>
            <button
              onClick={() => setFollowUpLead(null)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleFollowUpSubmit} className="p-6 space-y-5">
            <p className="text-body-sm text-secondary">
              Is client ko abhi qualified nahi kar sakte? Follow-up date daal do —
              us din assigned user ko email + dashboard notification mil jayegi.
            </p>

            <Field label="Follow-up Date" icon="event">
              <input
                type="date"
                required
                min={new Date().toISOString().split("T")[0]}
                value={followUpDateInput}
                onChange={(e) => setFollowUpDateInput(e.target.value)}
                className={inputCls}
              />
            </Field>

            {followUpError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {followUpError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setFollowUpLead(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={followUpLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {followUpLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">event_available</span>
                    Save Follow-up Date
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-xl p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span
                className="material-symbols-outlined text-[28px] text-error"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
              >
                delete
              </span>
            </div>
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">Delete this lead?</h3>
            <p className="text-body-md text-secondary mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-error text-on-error
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {deleteLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}