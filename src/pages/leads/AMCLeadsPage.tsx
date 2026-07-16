// src/pages/leads/AMCLeadsPage.tsx
// With error boundary - prevents redirect to login on API failure

import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchAMCLeads,
  createAMCLead,
  updateAMCLead,
  transitionAMCLead,
  type AMCLeadResponse,
  type CreateAMCLeadRequest,
  type AMCLeadFilterParams,
} from "../../services/amcLeadService";
import {
  AMC_LEAD_SOURCES,
  AMC_LEAD_STATUSES,
  type AMCLeadSource,
  type AMCLeadStatus,
} from "../../constants/amcLeadConstants";

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  NEW: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", label: "New" },
  CONTACTED: { bg: "bg-tertiary/10", text: "text-tertiary", border: "border-tertiary/20", label: "Contacted" },
  FOLLOW_UP: { bg: "bg-blue-500/10", text: "text-blue-700", border: "border-blue-500/20", label: "Follow Up" },
  QUOTATION_SENT: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/20", label: "Quotation Sent" },
  NEGOTIATION: { bg: "bg-purple-500/10", text: "text-purple-700", border: "border-purple-500/20", label: "Negotiation" },
  AMC_WON: { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/20", label: "AMC Won" },
  AMC_LOST: { bg: "bg-error/10", text: "text-error", border: "border-error/20", label: "AMC Lost" },
  CONVERTED: { bg: "bg-green-500/10", text: "text-green-700", border: "border-green-500/20", label: "Converted" },
};

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

const EMPTY_FORM: CreateAMCLeadRequest = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  certificationType: "",
  certificateNumber: "",
  source: "MANUAL",
  assignedToEmail: "",
  nextFollowUpDate: "",
};

const inputCls = "w-full px-3 py-2.5 bg-surface border border-outline-variant/30 rounded-lg text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

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

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

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

export default function AMCLeadsPage() {
  const navigate = useNavigate();
  const [amcLeads, setAMCLeads] = useState<AMCLeadResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AMCLeadStatus | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CreateAMCLeadRequest>(EMPTY_FORM);
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const [editLead, setEditLead] = useState<AMCLeadResponse | null>(null);
  const [editForm, setEditForm] = useState<CreateAMCLeadRequest>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // NEW — status dropdown (mirrors Sales Leads' status <select>). The
  // transitionAMCLead() API call already existed and worked fine — this
  // page just never had any UI wired to actually call it.
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // ── FOLLOW UP Modal State ──────────────────────────────────────────────────
  const [followUpLead, setFollowUpLead] = useState<AMCLeadResponse | null>(null);
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);

  const handleStatusChange = async (id: string, status: AMCLeadStatus, lead: AMCLeadResponse) => {
    // AMC_WON is special — same pattern as Sales Leads intercepting "WON":
    // instead of a plain status update, take the team straight to the
    // Create AMC form (prefilled from the lead). That form calls
    // markAmcLeadConverted() on success, which sets status=CONVERTED —
    // so AMC_WON is never actually persisted as a standalone status, it's
    // just the dropdown option that triggers the conversion flow.
    if (status === "AMC_WON") {
      handleConvertClick(lead);
      return;
    }

    if (status === "FOLLOW_UP") {
      setFollowUpLead(lead);
      setFollowUpDateInput(lead.nextFollowUpDate ?? "");
      setFollowUpError(null);
      return;
    }

    setStatusLoading(id);
    try {
      await transitionAMCLead(id, { targetStatus: status });
      loadAMCLeads(page);
    } finally {
      setStatusLoading(null);
    }
  };

  // ── FOLLOW UP Submit ───────────────────────────────────────────────────────
  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!followUpLead) return;
    if (!followUpDateInput) { setFollowUpError("Please select a follow-up date."); return; }

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      await transitionAMCLead(followUpLead.id, {
        targetStatus: "FOLLOW_UP",
        nextFollowUpDate: followUpDateInput,
      });

      setFollowUpLead(null);
      setFollowUpDateInput("");

      loadAMCLeads(page);

    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFollowUpError(err?.response?.data?.message ?? err?.message ?? "Failed to set follow-up date.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const loadAMCLeads = async (p = page) => {
    setLoading(true);
    setPageError(null);
    try {
      console.log("🔄 Loading AMC Leads...");
      const params: AMCLeadFilterParams = {
        page: p,
        size: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      };
      if (search) params.search = search;
      if (statusFilter !== "ALL") params.status = statusFilter as AMCLeadStatus;

      const data = await fetchAMCLeads(params);
      console.log("✅ AMC Leads loaded:", data);
      setAMCLeads(data.content);
      setTotalPages(data.totalPages);
      setTotalElements(data.totalElements);
    } catch (e: unknown) {
      const err = e as { 
        response?: { status?: number; data?: { message?: string } }; 
        message?: string;
      };
      
      // Log full error for debugging
      console.error("❌ Error loading AMC Leads:", {
        status: err?.response?.status,
        message: err?.response?.data?.message ?? err?.message,
        fullError: err,
      });

      const errorMsg = 
        err?.response?.status === 401 
          ? "Session expired. Please refresh page."
          : err?.response?.status === 404
          ? "Backend endpoint not found. Check if server is running."
          : err?.response?.data?.message ?? err?.message ?? "Failed to load AMC leads.";
      
      setPageError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAMCLeads(page);
  }, [page]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      loadAMCLeads(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      console.log("📝 Creating AMC Lead...", addForm);
      await createAMCLead({ ...addForm, nextFollowUpDate: addForm.nextFollowUpDate || undefined });
      console.log("✅ AMC Lead created successfully");
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
      loadAMCLeads(0);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      console.error("❌ Error creating AMC Lead:", err);
      setAddError(err?.response?.data?.message ?? err?.message ?? "Failed to create AMC lead.");
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (amcLead: AMCLeadResponse) => {
    setEditLead(amcLead);
    setEditForm({
      companyName: amcLead.companyName,
      contactName: amcLead.contactName,
      email: amcLead.email,
      phone: amcLead.phone,
      certificationType: amcLead.certificationType,
      certificateNumber: amcLead.certificateNumber,
      source: amcLead.source as AMCLeadSource,
      assignedToEmail: amcLead.assignedToEmail,
      nextFollowUpDate: amcLead.nextFollowUpDate ?? "",
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead) return;
    setEditLoading(true);
    setEditError(null);
    try {
      console.log("✏️ Updating AMC Lead...", editLead.id);
      await updateAMCLead(editLead.id, { ...editForm, nextFollowUpDate: editForm.nextFollowUpDate || undefined });
      console.log("✅ AMC Lead updated successfully");
      setEditLead(null);
      loadAMCLeads(page);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      console.error("❌ Error updating AMC Lead:", err);
      setEditError(err?.response?.data?.message ?? err?.message ?? "Failed to update AMC lead.");
    } finally {
      setEditLoading(false);
    }
  };

  // AMC lead "Won" -> instead of silently auto-creating an AMC with
  // amount=0, take the team straight to the Create AMC form, prefilled
  // with what we already know from the lead. The team fills in the real
  // contract value, dates, and installment plan, then submits normally —
  // CreateAmc.tsx calls markAmcLeadConverted() once that succeeds.
  const handleConvertClick = (lead: AMCLeadResponse) => {
    navigate("/amc/create", {
      state: {
        fromLeadId: lead.id,
        prefill: {
          clientName: lead.companyName,
          factoryName: lead.companyName,
          certificationType: lead.certificationType,
          renewalDate: lead.expiryDate,
          notes: lead.remarks,
          projectId: lead.projectId,
        },
      },
    });
  };

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(totalPages - 1, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  const pageStart = page * 10 + 1;
  const pageEnd = Math.min((page + 1) * 10, totalElements);

  return (
    <div className="max-w-[1440px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-lg font-semibold text-on-surface">AMC Leads</h3>
          <p className="text-body-md text-secondary mt-0.5">{loading ? "Loading…" : `${totalElements} total AMC leads`}</p>
        </div>
        <button
          onClick={() => {
            setAddForm(EMPTY_FORM);
            setAddError(null);
            setShowAdd(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-body-md font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New AMC Lead
        </button>
      </div>

      {/* Search + filter */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">search</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className={`${inputCls} pl-10`} />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:col-span-2 flex items-center gap-2 px-4 py-2.5 bg-surface-container border border-outline-variant/30 rounded-lg text-body-md text-on-surface hover:bg-surface-container-high transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">tune</span>
          Filters
        </button>

        <div className="md:col-span-6 flex flex-wrap gap-2 items-center">
          {showFilters && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AMCLeadStatus | "ALL")}
                className={`${inputCls} flex-1 min-w-[150px]`}
              >
                <option value="ALL">All Statuses</option>
                {AMC_LEAD_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {statusFilter !== "ALL" && (
                <button onClick={() => setStatusFilter("ALL")} className="text-body-sm text-error hover:underline">
                  Clear filters
                </button>
              )}
            </>
          )}

          <div className="flex-1" />

          <button className="p-2 border border-outline-variant/30 rounded-lg hover:bg-surface-container-high transition-all text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">download</span>
          </button>
        </div>
      </div>

      {/* Error bar with better diagnostics */}
      {pageError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-error-container/40 border border-error/20 rounded-lg text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <div className="flex-1">
            <p className="font-semibold">{pageError}</p>
            <p className="text-[11px] mt-1 opacity-80">Check browser console (F12) for details</p>
          </div>
          <button onClick={() => loadAMCLeads(page)} className="text-body-sm font-semibold hover:underline whitespace-nowrap">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                {["Company", "Contact", "Email", "Certificate", "Date", "Follow-up", "Status", "Actions"].map((h, i) => (
                  <th key={h} className="px-6 py-4 text-label-caps text-outline uppercase tracking-wider whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {h}
                      {i === 0 && <span className="material-symbols-outlined text-[14px]">arrow_downward</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : amcLeads.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="flex flex-col items-center gap-3 py-16 text-secondary">
                      <span className="material-symbols-outlined text-[48px] text-outline" style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}>
                        person_search
                      </span>
                      <p className="text-body-md">No AMC leads found. {search || statusFilter !== "ALL" ? "Try clearing your filters." : ""}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                amcLeads.map((amcLead) => {
                  const av = avatarColor(amcLead.contactName || amcLead.companyName);
                  const ini = initials(amcLead.contactName || amcLead.companyName || "?");

                  return (
                    <tr key={amcLead.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${av}`}>{ini}</div>
                          <p className="text-body-md font-semibold text-on-surface">{amcLead.companyName || "—"}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-body-md text-secondary">{amcLead.contactName || "—"}</td>
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        <a href={`mailto:${amcLead.email}`} className="text-primary hover:underline">
                          {amcLead.email || "—"}
                        </a>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-body-md text-secondary">
                          <p className="font-medium">{amcLead.certificationType || "—"}</p>
                          <p className="text-[11px] text-outline">{amcLead.certificateNumber || "—"}</p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {amcLead.updatedAt
                          ? new Date(amcLead.updatedAt).toLocaleDateString("en-IN")
                          : "—"}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {amcLead.nextFollowUpDate ? (
                          <span
                            className={`text-body-sm font-medium ${
                              amcLead.nextFollowUpDate === new Date().toISOString().split("T")[0]
                                ? "text-amber-600"
                                : amcLead.nextFollowUpDate < new Date().toISOString().split("T")[0]
                                ? "text-error"
                                : "text-secondary"
                            }`}
                          >
                            {new Date(amcLead.nextFollowUpDate).toLocaleDateString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {statusLoading === amcLead.id ? (
                          <span className="text-body-sm text-secondary animate-pulse">Updating…</span>
                        ) : (
                          <select
                            value={amcLead.status}
                            onChange={(e) => handleStatusChange(amcLead.id, e.target.value as AMCLeadStatus, amcLead)}
                            className={`border rounded-full px-3 py-1 text-[11px] font-bold
                              uppercase tracking-tight outline-none cursor-pointer appearance-none
                              transition-all focus:ring-2 focus:ring-primary/20
                              ${(STATUS_CONFIG[amcLead.status] ?? STATUS_CONFIG.NEW).bg}
                              ${(STATUS_CONFIG[amcLead.status] ?? STATUS_CONFIG.NEW).text}
                              ${(STATUS_CONFIG[amcLead.status] ?? STATUS_CONFIG.NEW).border}`}
                          >
                            {AMC_LEAD_STATUSES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(amcLead)} title="Edit" className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleConvertClick(amcLead)} title="Convert to AMC" className="p-2 rounded-lg hover:bg-tertiary/10 text-tertiary transition-colors">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-surface-container-highest/20 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4 text-body-sm text-secondary">
            <span>
              Showing <strong>{pageStart}–{pageEnd}</strong> of <strong>{totalElements}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              {pageNumbers.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium text-body-sm transition-all ${
                    page === p ? "bg-primary text-on-primary" : "border border-outline-variant/30 hover:bg-surface-container-high"
                  }`}
                >
                  {p + 1}
                </button>
              ))}

              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container-high disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">New AMC Lead</h2>
              <p className="text-body-sm text-secondary mt-0.5">Fill in the details to create a new AMC lead</p>
            </div>
            <button onClick={() => setShowAdd(false)} className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleAdd} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name" icon="domain">
                <input type="text" placeholder="ABC Ltd" required value={addForm.companyName} onChange={(e) => setAddForm((prev) => ({ ...prev, companyName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Contact Name" icon="person">
                <input type="text" placeholder="John Doe" required value={addForm.contactName} onChange={(e) => setAddForm((prev) => ({ ...prev, contactName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Email" icon="mail">
                <input type="email" placeholder="john@abc.com" required value={addForm.email} onChange={(e) => setAddForm((prev) => ({ ...prev, email: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Phone" icon="call">
                <input type="tel" placeholder="9876543210" required value={addForm.phone} onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Certification Type" icon="card_membership">
                <input type="text" placeholder="ISO 9001" required value={addForm.certificationType} onChange={(e) => setAddForm((prev) => ({ ...prev, certificationType: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Certificate Number" icon="assignment">
                <input type="text" placeholder="CERT-2024-001" required value={addForm.certificateNumber} onChange={(e) => setAddForm((prev) => ({ ...prev, certificateNumber: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Source" icon="hub">
                <select required value={addForm.source} onChange={(e) => setAddForm((prev) => ({ ...prev, source: e.target.value as AMCLeadSource }))} className={inputCls}>
                  {AMC_LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned To" icon="person_add">
                <input type="email" placeholder="user@standphill.com" value={addForm.assignedToEmail} onChange={(e) => setAddForm((prev) => ({ ...prev, assignedToEmail: e.target.value }))} className={inputCls} />
              </Field>
            </div>

            {addError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40 border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {addError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all">
                Cancel
              </button>
              <button type="submit" disabled={addLoading} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all">
                {addLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Create
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editLead && (
        <Modal onClose={() => setEditLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Edit AMC Lead</h2>
              <p className="text-body-sm text-secondary mt-0.5">{editLead.companyName}</p>
            </div>
            <button onClick={() => setEditLead(null)} className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleEdit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Company Name" icon="domain">
                <input type="text" required value={editForm.companyName} onChange={(e) => setEditForm((prev) => ({ ...prev, companyName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Contact Name" icon="person">
                <input type="text" required value={editForm.contactName} onChange={(e) => setEditForm((prev) => ({ ...prev, contactName: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Email" icon="mail">
                <input type="email" required value={editForm.email} onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Phone" icon="call">
                <input type="tel" required value={editForm.phone} onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Certification Type" icon="card_membership">
                <input type="text" required value={editForm.certificationType} onChange={(e) => setEditForm((prev) => ({ ...prev, certificationType: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Certificate Number" icon="assignment">
                <input type="text" required value={editForm.certificateNumber} onChange={(e) => setEditForm((prev) => ({ ...prev, certificateNumber: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="Source" icon="hub">
                <select required value={editForm.source} onChange={(e) => setEditForm((prev) => ({ ...prev, source: e.target.value as AMCLeadSource }))} className={inputCls}>
                  {AMC_LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Assigned To" icon="person_add">
                <input type="email" value={editForm.assignedToEmail} onChange={(e) => setEditForm((prev) => ({ ...prev, assignedToEmail: e.target.value }))} className={inputCls} />
              </Field>
            </div>

            {editError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40 border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {editError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button type="button" onClick={() => setEditLead(null)} className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all">
                Cancel
              </button>
              <button type="submit" disabled={editLoading} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all">
                {editLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Follow-up Date Modal */}
      {followUpLead && (
        <Modal onClose={() => setFollowUpLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Set Follow-up Date</h2>
              <p className="text-body-sm text-secondary mt-0.5">{followUpLead.companyName}</p>
            </div>
            <button onClick={() => setFollowUpLead(null)} className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleFollowUpSubmit} className="p-6 space-y-5">
            <p className="text-body-sm text-secondary">
              Is client ko abhi qualified/quotation stage pe nahi bhej sakte? Follow-up date daal do —
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
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40 border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {followUpError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setFollowUpLead(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={followUpLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
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
    </div>
  );
}