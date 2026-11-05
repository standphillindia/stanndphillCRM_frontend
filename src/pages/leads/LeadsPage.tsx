// src/pages/leads/LeadsPage.tsx
// Standphill CRM — Leads page
// UI fully rebuilt to match the Standphill design system.
// All API calls, logic, and state are preserved exactly from the original.

import { useEffect, useState, useMemo } from "react";
import { usePermissions } from "../../hooks/usePermissions";
import { useNavigate, useSearchParams } from "react-router-dom";
import FollowUpPanel from "../../components/leads/FollowUpPanel";
import PhoneWithCountry from "../../components/common/PhoneWithCountry";
import QuotationLookupModal from "../../components/quotation/QuotationLookupModal";
import { useAuth } from "../../context/AuthContext";
import { decodeJwt } from "../../utils/jwt";
import {
  fetchLeads,
  createLead,
  updateLead,
  deleteLead,
  transitionLead,
  setLeadFollowUp,
  setLeadRemark,
  fetchLostReasons,
  fetchLeadQuotationCounts,
  fetchLeadById,
  type LeadResponse,
  type CreateLeadRequest,
  type LeadFilterParams,
} from "../../services/leadService";
import { fetchUsers, type UserResponse as OrgUserResponse } from "../../services/userService";
import { useToastNotification } from "../../hooks/useToastNotification";
import { getApiErrorMessage, getApiErrorTitle } from "../../utils/apiError";
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

// Stages where a follow-up can be set — mirrors FOLLOW_UP_ELIGIBLE in
// LeadService. FOLLOW_UP is kept so leads still parked in that legacy status
// can be given a date.
const FOLLOW_UP_STATUSES: string[] = [
  "CONTACTED", "FOLLOW_UP", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "PI_RAISED",
];
// Same list, typed as statuses — used by the transition rules below.

// ── Status transitions ───────────────────────────────────────────────────────
// A lead may jump to any stage further along the pipeline, not just the next
// one: a client who rings back ready to buy goes from Contacted straight to
// Proposal or PI Raised. Going back is not offered — a deal that fell through
// is Lost, not "Qualified again". Mirrors validateTransition() in LeadService.

/** The sales stages in order. FOLLOW_UP is only for leads still parked there. */
const SALES_STAGES: LeadStatus[] = [
  "CONTACTED", "FOLLOW_UP", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "PI_RAISED",
];

const getAllowedStatuses = (current: LeadStatus): LeadStatus[] => {
  const i = SALES_STAGES.indexOf(current);
  if (i >= 0) {
    // Current stage, everything ahead of it, and Lost. FOLLOW_UP is never
    // offered as a destination — it stopped being a stage, and the backend
    // refuses it; it only shows as the current value of a lead still
    // parked there from before that change.
    return [
      ...SALES_STAGES.slice(i).filter((sts) => sts !== "FOLLOW_UP" || sts === current),
      "LOST",
    ];
  }

  switch (current) {
    // An untouched lead opens with first contact — nothing else.
    case "NEW":              return ["NEW", "CONTACTED", "LOST"];
    case "PAYMENT_RECEIVED": return ["PAYMENT_RECEIVED", "READY_TO_WON"]; // Sales confirms once the TI exists
    case "READY_TO_WON":     return ["READY_TO_WON", "LOST"]; // WON stays Admin-only, via the Ready-to-Won review
    case "WON":              return ["WON"];
    case "LOST":             return ["LOST"];
    default:                 return ["NEW"];
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
  // assignedToEmail: Admin may pick one; for everyone else the backend
  // assigns the lead to its creator.
};

/** Today as yyyy-MM-dd in India time — the default lead date. */
const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** dd/mm/yyyy for a yyyy-MM-dd date. */
const leadDateLabel = (d?: string | null) => {
  if (!d) return "";
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};

/**
 * Number for a wa.me link: digits only, with the country code. Indian
 * numbers are saved without it (10 digits), so 91 is added; others are
 * saved as "+code number" and already carry it.
 */
const whatsappNumber = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
};

// ── Form field config ─────────────────────────────────────────────────────────
// NOTE: "Next Follow-up Date" field removed from here on purpose — it no
// longer appears in either the New Lead or Edit Lead forms. The table's
// FOLLOW_UP status flow (unchanged) remains the only way to set/update it.

// Every field is optional — the team often gets a lead with only part of
// the details (just a name, just a number). The one rule, enforced here and
// on the backend: at least one of company / contact / phone / email, so the
// row can actually be followed up.
const FORM_FIELDS = [
  { name: "companyName",       label: "Company Name",       type: "text",  placeholder: "ABC Pvt Ltd",          icon: "domain"      },
  { name: "contactName",       label: "Contact Name",       type: "text",  placeholder: "Rahul Sharma",          icon: "person"      },
  { name: "email",             label: "Email",              type: "email", placeholder: "rahul@abc.com",         icon: "mail"        },
  { name: "phone",             label: "Phone",              type: "tel",   placeholder: "9876543210",            icon: "call"        },
  { name: "product",           label: "Product",            type: "text",  placeholder: "ISO 9001",              icon: "inventory_2" },
  { name: "certificationType", label: "Certification Type", type: "text",  placeholder: "ISO",                   icon: "verified"    },
] as const;

const IDENTITY_HINT = "All fields are optional — fill whatever you have. At least one of company name, contact name, phone or email is needed.";

const hasIdentity = (f: { companyName?: string; contactName?: string; phone?: string; email?: string }) =>
  [f.companyName, f.contactName, f.phone, f.email].some((v) => (v ?? "").trim() !== "");

const sourceLabel = (source: string | null | undefined) =>
  LEAD_SOURCES.find((s) => s.value === source)?.label
  ?? (source ? source.toLowerCase().replace(/_/g, " ") : "—");

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[...Array(13)].map((_, i) => (
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
  optional,
  children,
}: {
  label: string;
  icon: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
        {optional && (
          <span className="normal-case tracking-normal text-secondary/70">(optional)</span>
        )}
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

  const navigate = useNavigate();
  const toast = useToastNotification();

  // ── Quotations column: how many quotations each lead on this page has ──
  const [quotationCounts, setQuotationCounts] = useState<Record<string, number>>({});
  const [quotationLead, setQuotationLead] = useState<LeadResponse | null>(null);

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

  // Sales users for the "Assign To" dropdown on New Lead / Edit Lead —
  // fetched from whichever backend this build points at (local DB while
  // developing, live Neon DB once deployed), so this needs zero changes
  // when pushed live — it always reflects real, current Sales users.
  const [salesUsers, setSalesUsers] = useState<OrgUserResponse[]>([]);

  useEffect(() => {
    fetchUsers({ role: "ENGINEER" }).then(setEngineers).catch(() => setEngineers([]));
    // Ops person dropdown for the WON review — every user works; Admin
    // typically picks someone from Operations.
    fetchUsers({}).then(setOpsUsers).catch(() => setOpsUsers([]));
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
    fetchUsers({ role: "SALES" }).then(setSalesUsers).catch(() => setSalesUsers([]));
  }, []);

  // Leads only carry the assignee's email. Resolve it to a name for display;
  // fall back to the local part of the address so a removed user still shows
  // something recognisable rather than an empty cell.
  const assigneeName = (email?: string | null) => {
    if (!email || email === "Unassigned") return "";
    const match = salesUsers.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    return match?.fullName || email.split("@")[0];
  };

  // ── FOLLOW UP Modal State (unchanged — table's status flow) ──────────────
  const [followUpLead, setFollowUpLead] = useState<LeadResponse | null>(null);

  /**
   * Stage popup — every status change that now needs something written.
   *
   * Contacted → PI Raised ask for the next follow-up date and a remark, so
   * no lead sits in the pipeline without a date on somebody's call list.
   * Lost asks for a reason and remarks. The take-ownership email is part
   * of the same popup, shown only on the first move out of NEW.
   */
  const [stage, setStage] = useState<{ lead: LeadResponse; target: LeadStatus } | null>(null);
  const [stageForm, setStageForm] = useState({
    nextFollowUpDate: "",
    remark: "",
    lostReason: "",
    assignedToEmail: "",
  });
  const [stageError, setStageError] = useState<string | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [lostReasons, setLostReasons] = useState<string[]>([]);

  // Loaded from the backend so the dropdown can't drift from what the
  // server accepts.
  useEffect(() => {
    fetchLostReasons().then(setLostReasons).catch(() => setLostReasons([]));
  }, []);
  const [followUpDateInput, setFollowUpDateInput] = useState("");
  const [followUpRemarkInput, setFollowUpRemarkInput] = useState("");
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  // Remarks column — a general note on the lead, editable at any status.
  const [remarkLead, setRemarkLead] = useState<LeadResponse | null>(null);
  const [remarkInput, setRemarkInput] = useState("");
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  // Bumped after a follow-up is saved so the call-list panel reloads too.
  const [followUpRefresh, setFollowUpRefresh] = useState(0);

  // Admin-only "Assigned to" filter. Empty = everyone. The backend ignores
  // it for non-admins, so a salesperson can't use it to read someone
  // else's leads even by editing the request.
  const [ownerFilter, setOwnerFilter] = useState("");

  // ── State ──────────────────────────────────────────────────────────────────
  const [leads,         setLeads]         = useState<LeadResponse[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [page,          setPage]          = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [pageError,     setPageError]     = useState<string | null>(null);

  // Filters
  const [search,        setSearch]        = useState("");

  // Opened from Admin Panel → Activity Log (/leads?leadId=…): show ONLY
  // that lead. Searching by name wasn't enough — every website enquiry is
  // named "Website Lead", so a name search returned hundreds of rows.
  const [searchParams, setSearchParams] = useSearchParams();
  const leadIdParam = searchParams.get("leadId");
  const [fetchedFocusLead, setFocusLead] = useState<LeadResponse | null>(null);
  // Only counts while the URL still asks for that lead.
  const focusLead = leadIdParam && fetchedFocusLead?.id === leadIdParam ? fetchedFocusLead : null;
  useEffect(() => {
    if (!leadIdParam) return;
    fetchLeadById(leadIdParam)
      .then((l) => {
        setFocusLead(l);
        fetchLeadQuotationCounts([l.id]).then((c) => setQuotationCounts((prev) => ({ ...prev, ...c }))).catch(() => {});
      })
      .catch(() => {
        setFocusLead(null);
        toast.error("Lead not found", "It may have been deleted.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadIdParam]);
  const clearFocusLead = () => {
    searchParams.delete("leadId");
    setSearchParams(searchParams, { replace: true });
  };
  const shownLeads = focusLead ? [focusLead] : leads;
  const [statusFilter,  setStatusFilter]  = useState<LeadStatus | "ALL">("ALL");
  const [sourceFilter,  setSourceFilter]  = useState("");
  // Lead date range (both days included). Also what the Excel download uses.
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");
  const [exporting,     setExporting]     = useState(false);
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

  // ── Current user role + email (from JWT) ──────────────────────────────────
  const { token } = useAuth();
  const decoded   = decodeJwt(token);
  const myRole    = decoded?.role ?? "";          // "ADMIN", "SALES", etc.
  const myEmail   = decoded?.sub  ?? "";          // logged-in user's email
  const isSales   = myRole === "SALES";
  // Everyone's leads (owner filter, pick owner on a new lead): Admin, or
  // "All leads" in Roles & Permissions. Reassigning needs its Edit tick.
  const perms     = usePermissions();
  const isAdmin   = myRole === "ADMIN" || perms.can("LEADS_ALL");
  const canReassign = myRole === "ADMIN" || perms.can("LEADS_ALL", "EDIT");

  // ── Load ───────────────────────────────────────────────────────────────────
  // The filters on screen, as API params — shared by the table and the
  // Excel download so both always show the same leads.
  const buildFilterParams = (p: number, size: number): LeadFilterParams => {
    const params: LeadFilterParams = {
      page: p, size, sortBy: "createdAt", sortDir: "desc",
    };
    if (search)                  params.search = search;
    if (statusFilter !== "ALL")  params.status = statusFilter as LeadStatus;
    if (sourceFilter)            params.source = sourceFilter;
    if (dateFrom)                params.from = dateFrom;
    if (dateTo)                  params.to = dateTo;
    // SALES users see only their own assigned leads; ADMIN sees all, or
    // one salesperson's when the Assigned-to filter is set.
    if (isSales && !isAdmin && myEmail) params.assignedToEmail = myEmail;
    else if (isAdmin && ownerFilter) params.assignedToEmail = ownerFilter;
    return params;
  };

  const loadLeads = async (p = page) => {
    setLoading(true);
    setPageError(null);
    try {
      const params = buildFilterParams(p, 10);

      const data = await fetchLeads(params);
      setLeads(data.content);
      // Keep the single lead opened from the Activity Log fresh after an
      // edit / status change on it.
      if (leadIdParam) fetchLeadById(leadIdParam).then(setFocusLead).catch(() => {});
      // One request for the whole page. A failure only hides the counts —
      // it must not break the leads table.
      fetchLeadQuotationCounts(data.content.map((l) => l.id))
        .then(setQuotationCounts)
        .catch(() => setQuotationCounts({}));
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
  }, [search, statusFilter, sourceFilter, ownerFilter, dateFrom, dateTo, isAdmin]);

  // ── Excel download — every lead matching the filters (all pages) ──────────
  const downloadExcel = async () => {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      toast.error("Check the dates", "The From date is after the To date.");
      return;
    }
    setExporting(true);
    try {
      const all: LeadResponse[] = [];
      for (let p = 0; p < 200; p++) {
        const data = await fetchLeads(buildFilterParams(p, 500));
        all.push(...data.content);
        if (p + 1 >= data.totalPages || data.content.length === 0) break;
      }
      if (all.length === 0) {
        toast.warning("No leads", "No leads match these filters — nothing to download.");
        return;
      }

      const day = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-") : "";
      const time = (iso?: string | null) =>
        iso ? new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "";

      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Leads", { views: [{ state: "frozen", ySplit: 1 }] });
      ws.columns = [
        { header: "Lead date", key: "leadDate", width: 12 },
        { header: "Entered in CRM", key: "date", width: 14 },
        { header: "Time", key: "time", width: 9 },
        { header: "Name", key: "name", width: 24 },
        { header: "Company", key: "company", width: 28 },
        { header: "Mobile", key: "phone", width: 14 },
        { header: "Email", key: "email", width: 28 },
        { header: "Status", key: "status", width: 16 },
        { header: "Source", key: "source", width: 16 },
        { header: "Product", key: "product", width: 28 },
        { header: "Certification", key: "cert", width: 14 },
        { header: "Assigned to", key: "owner", width: 24 },
        { header: "Next follow-up", key: "follow", width: 14 },
        { header: "Remarks", key: "remarks", width: 40 },
        { header: "Lost reason", key: "lost", width: 24 },
        { header: "Page (link)", key: "link", width: 40 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
      all.forEach((l) => {
        ws.addRow({
          leadDate: leadDateLabel(l.leadDate).replace(/\//g, "-") || day(l.createdAt),
          date: day(l.createdAt),
          time: time(l.createdAt),
          name: l.contactName ?? "",
          company: l.companyName ?? "",
          phone: l.phone ?? "",
          email: l.email ?? "",
          status: (l.status ?? "").replace(/_/g, " "),
          source: LEAD_SOURCES.find((s) => s.value === l.source)?.label ?? l.source ?? "",
          product: l.product ?? "",
          cert: l.certificationType ?? "",
          owner: l.assignedToEmail && l.assignedToEmail !== "Unassigned" ? l.assignedToEmail : "Unassigned",
          follow: l.nextFollowUpDate ? day(`${l.nextFollowUpDate}T00:00:00`) : "",
          remarks: l.remarks ?? "",
          lost: l.lostReason ?? "",
          link: l.sourcePage ?? "",
        });
      });
      ws.getColumn("phone").numFmt = "@";
      ws.getColumn("remarks").alignment = { wrapText: true, vertical: "top" };

      const buffer = await wb.xlsx.writeBuffer();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
      const range = dateFrom || dateTo ? `${dateFrom || "start"}_to_${dateTo || "today"}` : "all";
      a.download = `leads_${range}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success("Excel ready", `${all.length} lead${all.length === 1 ? "" : "s"} downloaded.`);
    } catch (e) {
      toast.error("Download failed", getApiErrorMessage(e, "Could not create the Excel file."));
    } finally {
      setExporting(false);
    }
  };

  // Leads whose long Product text is shown in full ("Read more").
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const toggleProduct = (id: string) =>
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Status picked in the table or on a phone card.
  const pickStatus = (lead: LeadResponse, status: LeadStatus) => {
    if (status === "WON") {
      setWonLead(lead);
      setWonForm({ amount: "", expectedCloseDate: "", notes: "", assignedEngineerId: "", departmentId: "", opsPersonId: "" });
      setWonError(null);
      return;
    }

    // Everything between Contacted and PI Raised,
    // plus Lost, goes through the popup — the
    // backend refuses these without a date or a
    // remark, so asking here avoids a failed call.
    if (FOLLOW_UP_STATUSES.includes(status) || status === "LOST") {
      setStage({ lead, target: status });
      setStageForm({
        nextFollowUpDate: "",
        remark: "",
        lostReason: "",
        assignedToEmail: "",
      });
      setStageError(null);
      return;
    }

    handleStatusChange(lead.id, status);
  };

  // ── Create ─────────────────────────────────────────────────────────────────
  // NOTE: no longer strips/forwards nextFollowUpDate — the field doesn't
  // exist in this form anymore, so the payload is sent as-is.
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasIdentity(addForm)) {
      setAddError("Enter at least one of: company name, contact name, phone or email.");
      return;
    }
    setAddLoading(true); setAddError(null);
    try {
      const created = await createLead(addForm);
      setShowAdd(false); setAddForm(EMPTY_FORM); loadLeads(0);

      if (created.alreadyExisted) {
        // Same number came in within 24 hours: no new lead was made, the
        // details went into the existing one. Say so — otherwise a lead
        // owned by someone else just "doesn't appear" and looks like a bug.
        const who = created.ownerName || created.assignedToEmail || "another team member";
        const label = [created.companyName, created.phone].filter(Boolean).join(" · ") || "This client";
        const mine = (created.assignedToEmail ?? "").toLowerCase() === myEmail.toLowerCase();
        toast.warning(
          "Lead already exists",
          mine
            ? `${label} is already in your leads. No new lead was made — the details you entered were added to it.`
            : `${label} is already a lead assigned to ${who}, so it won't show in your list. No new lead was made — the details you entered were added to that lead's remarks. Ask ${who} or Admin if it should be yours.`,
          15000
        );
      } else {
        toast.success("Lead added", [created.companyName, created.contactName].filter(Boolean).join(" · ") || "New lead saved.");
      }
    } catch (e: unknown) {
      // The server's own reason when it has one (missing details, no
      // permission, a value already used…), a plain fallback otherwise.
      const status = (e as { response?: { status?: number } })?.response?.status;
      setAddError(
        status === 403
          ? getApiErrorMessage(e, "You don't have permission to add leads. Ask Admin to give your role access to Leads.")
          : getApiErrorMessage(e, "Could not add the lead. Check your internet connection and try again.")
      );
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
      leadDate: lead.leadDate ?? "",
    });
    setEditError(null);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead) return;
    if (!hasIdentity(editForm)) {
      setEditError("Enter at least one of: company name, contact name, phone or email.");
      return;
    }
    setEditLoading(true); setEditError(null);
    try {
      await updateLead(editLead.id, {
        ...editForm,
        nextFollowUpDate: editForm.nextFollowUpDate || undefined,
        // Only sent when it was changed — blank or same = keep as it is.
        leadDate: editForm.leadDate && editForm.leadDate !== editLead.leadDate ? editForm.leadDate : undefined,
      });
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
      //
      // A toast rather than alert(): the browser dialog blocks the page
      // until dismissed and strips the formatting out of longer messages.
      toast.error(getApiErrorTitle(err, "Status not changed"), getApiErrorMessage(err, "Failed to update status."));
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

  // ── Stage popup submit ───────────────────────────────────────────────────
  const submitStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage) return;

    const { lead, target } = stage;
    const needsFollowUp = FOLLOW_UP_STATUSES.includes(target);
    const isLost = target === "LOST";
    // First move out of NEW: whoever does it becomes the owner.
    const needsOwner =
      target === "CONTACTED" &&
      lead.status === "NEW" &&
      (!lead.assignedToEmail || lead.assignedToEmail === "Unassigned");

    if (needsOwner && !stageForm.assignedToEmail.trim())
      return setStageError("Enter your email to take ownership of this lead.");
    if (needsFollowUp && !stageForm.nextFollowUpDate)
      return setStageError("Pick the next follow-up date.");
    if (isLost && !stageForm.lostReason) return setStageError("Pick a reason.");
    if (!stageForm.remark.trim())
      return setStageError(isLost ? "Add remarks explaining what happened." : "Add a remark.");
    // Same rule the backend enforces — said here so the user isn't left
    // typing a remark for a move that can't go through yet.
    if (target === "PI_RAISED" && !quotationCounts[lead.id])
      return setStageError(
        "Link this client's quotation first — Accounts raise the PI from it. Use “+ Quotation” in the Quotations column."
      );

    setStageLoading(true);
    setStageError(null);
    try {
      await transitionLead(lead.id, {
        targetStatus: target,
        remark: stageForm.remark.trim(),
        nextFollowUpDate: needsFollowUp ? stageForm.nextFollowUpDate : undefined,
        lostReason: isLost ? stageForm.lostReason : undefined,
        assignedToEmail: needsOwner ? stageForm.assignedToEmail.trim() : undefined,
      });

      setStage(null);
      setFollowUpRefresh((k) => k + 1);
      loadLeads(page);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setStageError(err?.response?.data?.message ?? err?.message ?? "Failed to update this lead.");
    } finally {
      setStageLoading(false);
    }
  };

  // ── Follow-up (date + remark, any stage) ──────────────────────────────────
  // Follow-up used to be a status, so a lead could only be chased between
  // Contacted and Qualified. It's now a date the lead carries at whatever
  // stage it's really at — Proposal, Negotiation, PI Raised — with a remark
  // saying why. The status is never touched here.
  const openFollowUp = (lead: LeadResponse) => {
    setFollowUpLead(lead);
    setFollowUpDateInput(lead.nextFollowUpDate ?? "");
    setFollowUpRemarkInput(lead.followUpRemark ?? "");
    setFollowUpError(null);
  };

  const afterFollowUpSaved = () => {
    setFollowUpLead(null);
    setFollowUpDateInput("");
    setFollowUpRemarkInput("");
    loadLeads(page);
    setFollowUpRefresh((n) => n + 1);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!followUpLead) return;
    if (!followUpDateInput) { setFollowUpError("Please select a follow-up date."); return; }
    if (!followUpRemarkInput.trim()) {
      setFollowUpError("Add a remark — whoever makes the call needs to know why they're calling.");
      return;
    }

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      await setLeadFollowUp(followUpLead.id, followUpDateInput, followUpRemarkInput.trim());
      afterFollowUpSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFollowUpError(err?.response?.data?.message ?? err?.message ?? "Failed to save the follow-up.");
    } finally {
      setFollowUpLoading(false);
    }
  };

  // ── Remarks (general note, any status) ────────────────────────────────────
  const openRemark = (lead: LeadResponse) => {
    setRemarkLead(lead);
    setRemarkInput(lead.remarks ?? "");
    setRemarkError(null);
  };

  const handleRemarkSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remarkLead) return;

    setRemarkSaving(true);
    setRemarkError(null);
    try {
      // An empty box clears the remark — no separate delete button needed.
      await setLeadRemark(remarkLead.id, remarkInput.trim());
      setRemarkLead(null);
      setRemarkInput("");
      loadLeads(page);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setRemarkError(err?.response?.data?.message ?? err?.message ?? "Failed to save the remark.");
    } finally {
      setRemarkSaving(false);
    }
  };

  // Takes a finished follow-up off the call list.
  const handleFollowUpClear = async () => {
    if (!followUpLead) return;

    setFollowUpLoading(true);
    setFollowUpError(null);

    try {
      await setLeadFollowUp(followUpLead.id, null);
      afterFollowUpSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setFollowUpError(err?.response?.data?.message ?? err?.message ?? "Failed to clear the follow-up.");
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
        <div className="flex items-center gap-3">
          {/* Quotations are raised straight off a lead, usually right after
              the first call — so the entry point belongs here, next to the
              lead itself, not buried under the Payments module. */}
          <button
            onClick={() => navigate("/quotations?new=1")}
            className="flex items-center gap-2 px-4 py-2.5 border border-primary text-primary
              rounded-lg text-body-md font-semibold
              hover:bg-primary/5 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">request_quote</span>
            New Quotation
          </button>
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
      </div>

      {/* The call list. Sits above the table rather than inside it because
          it answers a different question — not "show me my leads" but
          "who am I supposed to ring today". */}
      <FollowUpPanel
        onEditFollowUp={openFollowUp}
        assignedToEmail={isAdmin ? ownerFilter : undefined}
        refreshKey={followUpRefresh}
      />

      {/* Opened from Admin Panel → Activity Log — only that one lead is shown */}
      {focusLead && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-lg
          bg-primary/10 border border-primary/20 text-body-sm text-on-surface">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">history</span>
            Showing the lead opened from the Activity Log:
            <span className="font-semibold">
              {[focusLead.companyName, focusLead.contactName, focusLead.phone].filter(Boolean).join(" · ")}
            </span>
          </span>
          <button onClick={clearFocusLead} className="font-semibold text-primary hover:underline">
            Show all leads
          </button>
        </div>
      )}

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

          {/* Assigned-to filter — admin only. Each salesperson already sees
              only their own leads, so there's nothing for them to filter. */}
          {isAdmin && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className={`px-3 py-2 border rounded-lg text-body-sm outline-none cursor-pointer
                focus:ring-2 focus:ring-primary/20 focus:border-primary
                ${ownerFilter
                  ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                  : "bg-surface-container-low border-outline-variant/20 text-on-surface"}`}
            >
              <option value="">Assigned to: Everyone</option>
              {salesUsers.map((u) => (
                <option key={u.id} value={u.email}>
                  {u.fullName || u.email}
                </option>
              ))}
            </select>
          )}

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

          {/* Lead date range — the day the enquiry came in, e.g. 9th to today. */}
          <div
            className={`w-full sm:w-auto flex items-center gap-1.5 px-2 py-1 border rounded-lg text-body-sm
              ${dateFrom || dateTo
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container-low border-outline-variant/20 text-on-surface"}`}
          >
            <span className="material-symbols-outlined text-[18px]">date_range</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Lead date from"
              title="Lead date from"
              className="flex-1 sm:flex-none min-w-0 bg-transparent outline-none text-body-sm"
            />
            <span className="text-secondary">to</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Lead date to"
              title="Lead date to"
              className="flex-1 sm:flex-none min-w-0 bg-transparent outline-none text-body-sm"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="ml-1 text-error hover:underline"
                aria-label="Clear dates"
                title="Clear dates"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex-1" />

          {/* Excel — the leads matching the filters above (all pages). */}
          <button
            onClick={downloadExcel}
            disabled={exporting}
            title="Download these leads as Excel"
            aria-label="Download Excel"
            className="flex items-center gap-1 p-2 border border-outline-variant/30 rounded-lg
            hover:bg-surface-container-high transition-all text-on-surface-variant disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            {exporting && <span className="text-body-sm">Preparing…</span>}
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

      {/* ── Phone: one card per lead (the table below is for laptops) ───────── */}
      <div className="lg:hidden space-y-2.5 mb-3">
        {loading && !focusLead ? (
          <div className="glass-card rounded-xl p-6 text-center text-body-sm text-secondary">Loading leads…</div>
        ) : shownLeads.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-body-sm text-secondary">
            No leads found.
            {search || statusFilter !== "ALL" || sourceFilter ? " Try clearing your filters." : ""}
          </div>
        ) : (
          shownLeads.map((lead) => {
            const av = avatarColor(lead.contactName || lead.companyName);
            const ini = initials(lead.contactName || lead.companyName || "?");
            const day = lead.leadDate
              ? leadDateLabel(lead.leadDate)
              : lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN") : "";
            const today = new Date().toISOString().split("T")[0];
            return (
              <div key={lead.id} className="glass-card rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${av}`}>
                    {ini}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-on-surface leading-tight truncate">
                      {lead.contactName || lead.companyName || "—"}
                    </p>
                    <p className="text-[12px] text-secondary truncate">
                      {[lead.contactName ? lead.companyName : null, sourceLabel(lead.source)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {statusLoading === lead.id ? (
                    <span className="text-[11px] text-secondary animate-pulse">Updating…</span>
                  ) : (
                    <select
                      value={lead.status}
                      onChange={(e) => pickStatus(lead, e.target.value as LeadStatus)}
                      aria-label="Status"
                      className={`shrink-0 max-w-[130px] border rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase outline-none
                        ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).bg}
                        ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).text}
                        ${(STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.NEW).border}`}
                    >
                      {getAllowedStatuses(lead.status as LeadStatus).map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-secondary">
                  {day && <span>📅 {day}</span>}
                  {(lead.certificationType || lead.product) && (
                    <span className="truncate max-w-full">{[lead.certificationType, lead.product].filter(Boolean).join(" · ")}</span>
                  )}
                  {lead.assignedToEmail && lead.assignedToEmail !== "Unassigned" && (
                    <span>👤 {assigneeName(lead.assignedToEmail)}</span>
                  )}
                </div>

                {FOLLOW_UP_STATUSES.includes(lead.status) && (
                  <button
                    type="button"
                    onClick={() => openFollowUp(lead)}
                    className={`mt-2 w-full text-left rounded-lg px-3 py-2 text-[12px] ${
                      lead.nextFollowUpDate && lead.nextFollowUpDate < today
                        ? "bg-red-50 text-red-700"
                        : lead.nextFollowUpDate === today
                        ? "bg-amber-50 text-amber-800"
                        : "bg-surface-container-low text-secondary"
                    }`}
                  >
                    ⏰ {lead.nextFollowUpDate
                      ? `Follow-up ${new Date(lead.nextFollowUpDate).toLocaleDateString("en-IN")}${lead.followUpRemark ? ` — ${lead.followUpRemark}` : ""}`
                      : "Set follow-up date"}
                  </button>
                )}

                {lead.remarks && (
                  <button
                    type="button"
                    onClick={() => openRemark(lead)}
                    className="mt-2 w-full text-left text-[12px] text-secondary line-clamp-2"
                  >
                    📝 {lead.remarks}
                  </button>
                )}

                {/* Thumb-sized actions. */}
                <div className="mt-3 grid grid-cols-4 gap-1.5 text-[12px] font-semibold">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="py-2 rounded-lg bg-green-50 text-green-800 text-center">📞 Call</a>
                  ) : (
                    <span className="py-2 rounded-lg bg-gray-50 text-gray-300 text-center">📞 Call</span>
                  )}
                  {lead.phone ? (
                    <a
                      href={`https://wa.me/${whatsappNumber(lead.phone)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 rounded-lg bg-emerald-50 text-emerald-800 text-center"
                    >
                      💬 WhatsApp
                    </a>
                  ) : (
                    <span className="py-2 rounded-lg bg-gray-50 text-gray-300 text-center">💬 WhatsApp</span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      quotationCounts[lead.id] ? setQuotationLead(lead) : navigate(`/quotations?new=1&leadId=${lead.id}`)
                    }
                    className="py-2 rounded-lg bg-blue-50 text-blue-800"
                  >
                    🧾 {quotationCounts[lead.id] ? `Quote (${quotationCounts[lead.id]})` : "+ Quote"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(lead)}
                    className="py-2 rounded-lg bg-surface-container-low text-on-surface"
                  >
                    ✏️ Edit
                  </button>
                </div>
                {!lead.remarks && (
                  <button
                    type="button"
                    onClick={() => openRemark(lead)}
                    className="mt-2 text-[12px] font-medium text-primary"
                  >
                    + Add remark
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New lead — floating button on a phone, above the bottom menu. */}
      <button
        type="button"
        onClick={() => { setAddForm(EMPTY_FORM); setAddError(null); setShowAdd(true); }}
        className="lg:hidden fixed right-4 bottom-24 z-30 w-14 h-14 rounded-2xl bg-primary text-on-primary text-3xl leading-none shadow-lg"
        aria-label="Add lead"
      >
        +
      </button>

      {/* ── Data table ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                {["Name", "Company", "Mobile", "Status", "Product", "Link", "Source", "Date", "Assigned To", "Follow-up", "Remarks", "Quotations", "Actions"].map((h, i) => (
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
              {loading && !focusLead ? (
                [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              ) : shownLeads.length === 0 ? (
                <tr>
                  <td colSpan={13}>
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
                shownLeads.map((lead) => {
                  const av    = avatarColor(lead.contactName || lead.companyName);
                  const ini   = initials(lead.contactName || lead.companyName || "?");
                  // Date and time are split so the time can sit under the
                  // date in a lighter weight — the column has to stay
                  // scannable, and a single "11/9/2026, 4:32 pm" string
                  // forces the row wider than the rest of the table.
                  // The date is the day the enquiry came in (leadDate). The time
                  // under it is when it was entered; for a lead entered on a
                  // later day it reads "Added 26/10/2026" instead, so nobody
                  // takes the entry time for the enquiry time.
                  const created = lead.createdAt ? new Date(lead.createdAt) : null;
                  const createdDay = created
                    ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(created)
                    : "";
                  const date = lead.leadDate
                    ? leadDateLabel(lead.leadDate)
                    : created ? created.toLocaleDateString("en-IN") : "—";
                  const time = lead.leadDate && createdDay && lead.leadDate !== createdDay
                    ? `Added ${leadDateLabel(createdDay)}`
                    : created
                    ? created.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : "";

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

                      {/* Mobile */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.phone ? (
                          <a
                            href={`tel:${lead.phone}`}
                            className="text-body-md text-secondary hover:text-primary
                              hover:underline transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lead.phone}
                          </a>
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {statusLoading === lead.id ? (
                          <span className="text-body-sm text-secondary animate-pulse">Updating…</span>
                        ) : (
                          <select
                            value={lead.status}
                            onChange={(e) => pickStatus(lead, e.target.value as LeadStatus)}
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

                      {/* Product — website / WhatsApp enquiries often put the
                          client's whole message here. Cut to 2 lines with
                          "Read more"; the full text is also on hover. */}
                      <td className="px-6 py-4 text-body-md text-secondary min-w-[180px] max-w-[260px]">
                        {lead.product ? (
                          <>
                            <p
                              title={lead.product}
                              className={`break-words whitespace-pre-line ${expandedProducts.has(lead.id) ? "" : "line-clamp-2"}`}
                            >
                              {lead.product}
                            </p>
                            {lead.product.length > 60 && (
                              <button
                                type="button"
                                onClick={() => toggleProduct(lead.id)}
                                className="mt-0.5 text-xs font-medium text-primary hover:underline"
                              >
                                {expandedProducts.has(lead.id) ? "Show less" : "Read more"}
                              </button>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Link — the page this enquiry was sent from, same as
                          the website admin's Link column. Marketing opens it
                          to see what the client was reading before calling. */}
                      <td className="px-6 py-4">
                        {lead.sourcePage ? (
                          <a
                            href={
                              lead.sourcePage.startsWith("http")
                                ? lead.sourcePage
                                : `https://${lead.sourcePage}`
                            }
                            target="_blank"
                            rel="noreferrer"
                            title={lead.sourcePage}
                            className="block max-w-[200px] truncate text-body-sm text-primary hover:underline"
                          >
                            {lead.sourcePage.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-6 py-4 text-body-md text-secondary capitalize">
                        {sourceLabel(lead.source)}
                      </td>

                      {/* Date + time */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        <div>{date}</div>
                        {time && (
                          <div className="text-xs text-outline">{time}</div>
                        )}
                      </td>

                      {/* Assigned To */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {lead.assignedToEmail && lead.assignedToEmail !== "Unassigned" ? (
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarColor(assigneeName(lead.assignedToEmail))}`}>
                              {initials(assigneeName(lead.assignedToEmail))}
                            </div>
                            <span className="text-body-sm text-secondary max-w-[140px] truncate" title={lead.assignedToEmail}>
                              {assigneeName(lead.assignedToEmail)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-body-sm text-outline italic">Unassigned</span>
                        )}
                      </td>

                      {/* Follow-up — click to set, move or clear. Only
                          offered between Contacted and PI Raised: before
                          contact there's nobody to call back, and after the
                          payment lands there's nothing left to chase. */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {FOLLOW_UP_STATUSES.includes(lead.status) ? (
                          lead.nextFollowUpDate ? (
                            <button
                              type="button"
                              onClick={() => openFollowUp(lead)}
                              title={lead.followUpRemark ?? "Edit follow-up"}
                              className="text-left group/fu"
                            >
                              <span
                                className={`flex items-center gap-1 text-body-sm font-medium group-hover/fu:underline ${
                                  lead.nextFollowUpDate === new Date().toISOString().split("T")[0]
                                    ? "text-amber-600"
                                    : lead.nextFollowUpDate < new Date().toISOString().split("T")[0]
                                    ? "text-error"
                                    : "text-secondary"
                                }`}
                              >
                                <span className="material-symbols-outlined text-[14px]">event</span>
                                {new Date(lead.nextFollowUpDate).toLocaleDateString("en-IN")}
                              </span>
                              {lead.followUpRemark && (
                                <span className="block text-xs text-outline max-w-[160px] truncate">
                                  {lead.followUpRemark}
                                </span>
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openFollowUp(lead)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed
                                border-outline-variant/50 text-body-sm text-secondary
                                hover:border-primary hover:text-primary transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">add</span>
                              Set
                            </button>
                          )
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      {/* Remarks — the salesperson's running note on the
                          lead. Unlike the follow-up remark it's available at
                          every status, closed leads included: "Lost to a
                          cheaper consultant" is worth keeping. */}
                      <td className="px-6 py-4">
                        {lead.remarks ? (
                          <button
                            type="button"
                            onClick={() => openRemark(lead)}
                            title={lead.remarks}
                            className="text-left text-body-sm text-secondary max-w-[200px]
                              line-clamp-2 hover:text-primary hover:underline"
                          >
                            {lead.remarks}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openRemark(lead)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed
                              border-outline-variant/50 text-body-sm text-secondary whitespace-nowrap
                              hover:border-primary hover:text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit_note</span>
                            Add
                          </button>
                        )}
                      </td>

                      {/* Quotations — how many went to this client. Click to
                          read them; with none yet, start one already linked
                          to this lead (Accounts then see it on Payments). */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {quotationCounts[lead.id] ? (
                          <button
                            type="button"
                            onClick={() => setQuotationLead(lead)}
                            title="View quotations sent to this client"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/5 text-primary text-body-sm font-semibold hover:bg-primary/10"
                          >
                            <span className="material-symbols-outlined text-[16px]">request_quote</span>
                            {quotationCounts[lead.id]}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/quotations?new=1&leadId=${lead.id}`)}
                            title="Create a quotation for this lead"
                            className={`inline-flex items-center gap-1 text-body-sm font-medium hover:underline ${
                              lead.status === "NEGOTIATION" || lead.status === "PI_RAISED"
                                ? "text-error"
                                : "text-outline"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[16px]">add</span>
                            Quotation
                          </button>
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
        {!loading && !focusLead && totalElements > 0 && (
          <div className="px-4 lg:px-6 py-4 flex flex-wrap items-center justify-between gap-2
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
      <QuotationLookupModal
        isOpen={quotationLead !== null}
        leadId={quotationLead?.id}
        clientLabel={
          quotationLead
            ? [quotationLead.companyName, quotationLead.contactName].filter(Boolean).join(" · ")
            : undefined
        }
        onClose={() => setQuotationLead(null)}
      />

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
            <p className="text-body-sm text-secondary">{IDENTITY_HINT}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FORM_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} icon={f.icon}>
                  {f.name === "phone" ? (
                    // Country code picker — India by default.
                    <PhoneWithCountry
                      value={addForm.phone}
                      onChange={(v) => setAddForm((prev) => ({ ...prev, phone: v }))}
                      className={inputCls}
                    />
                  ) : (
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={addForm[f.name] ?? ""}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    className={inputCls}
                  />
                  )}
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
              {/* The day the enquiry came in — change it when entering a
                  lead from an earlier day (e.g. a Meta Ads lead from last
                  night). Filters and the Excel go by this date. */}
              <Field label="Lead Date (received on)" icon="event">
                <input
                  type="date"
                  value={addForm.leadDate || todayIst()}
                  max={todayIst()}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, leadDate: e.target.value || undefined }))}
                  className={inputCls}
                />
              </Field>
              {/* Ownership of a manually added lead (backend enforces the same rule):
                  - Admin: pick a salesperson, or leave on round-robin.
                  - Everyone else: the lead is theirs.
                  Website enquiries are always round-robin. */}
              {isAdmin ? (
                <Field label="Assign To" icon="manage_accounts">
                  <select
                    value={addForm.assignedToEmail ?? ""}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, assignedToEmail: e.target.value || undefined }))}
                    className={inputCls}
                  >
                    <option value="">Auto (round-robin)</option>
                    {salesUsers.map((u) => (
                      <option key={u.id} value={u.email}>{u.fullName} ({u.email})</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Assigned To" icon="manage_accounts">
                  <div className={`${inputCls} flex items-center gap-2 text-on-surface-variant bg-surface-variant/40 cursor-not-allowed`}>
                    <span className="material-symbols-outlined text-[16px] text-primary">person</span>
                    <span className="text-body-sm truncate">You{myEmail ? ` (${myEmail})` : ""}</span>
                  </div>
                </Field>
              )}
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
            <p className="text-body-sm text-secondary">{IDENTITY_HINT}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FORM_FIELDS.map((f) => (
                <Field key={f.name} label={f.label} icon={f.icon}>
                  {f.name === "phone" ? (
                    // Country code picker — India by default.
                    <PhoneWithCountry
                      value={editForm.phone}
                      onChange={(v) => setEditForm((prev) => ({ ...prev, phone: v }))}
                      className={inputCls}
                    />
                  ) : (
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={editForm[f.name] ?? ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    className={inputCls}
                  />
                  )}
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
              <Field label="Lead Date (received on)" icon="event">
                <input
                  type="date"
                  value={editForm.leadDate ?? ""}
                  max={todayIst()}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, leadDate: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              {/* Reassigning a lead to someone else: Admin, or All leads → Edit
                  (the backend refuses it for everyone else). */}
              {canReassign && (
              <Field label="Reassign To (Optional)" icon="manage_accounts">
                <select
                  value={editForm.assignedToEmail ?? ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, assignedToEmail: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">— Keep current assignment —</option>
                  {salesUsers.map((u) => (
                    <option key={u.id} value={u.email}>{u.fullName} ({u.email})</option>
                  ))}
                </select>
              </Field>
              )}
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
      {/* ── Stage popup ──────────────────────────────────────────────
          One popup for every move that needs something written down: the
          next date and a remark for the open stages, a reason and remarks
          for Lost, and the owner's email the first time a lead leaves NEW. */}
      {stage && (() => {
        const { lead, target } = stage;
        const needsFollowUp = FOLLOW_UP_STATUSES.includes(target);
        const isLost = target === "LOST";
        const needsOwner =
          target === "CONTACTED" &&
          lead.status === "NEW" &&
          (!lead.assignedToEmail || lead.assignedToEmail === "Unassigned");
        const today = new Date().toISOString().slice(0, 10);
        const label = (STATUS_CONFIG[target] ?? STATUS_CONFIG.NEW).label;

        return (
          <Modal onClose={() => setStage(null)}>
            <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <h2 className="text-headline-md font-semibold text-on-surface">
                  {isLost ? "Mark as Lost" : `Move to ${label}`}
                </h2>
                <p className="text-body-sm text-secondary mt-0.5">
                  {lead.companyName || lead.contactName}
                </p>
              </div>
              <button
                onClick={() => setStage(null)}
                className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={submitStage} className="p-6 space-y-5">
              {needsOwner && (
                <Field label="Your Email" icon="mail">
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="you@standphill.com"
                    value={stageForm.assignedToEmail}
                    onChange={(e) => setStageForm((f) => ({ ...f, assignedToEmail: e.target.value }))}
                    className={inputCls}
                  />
                  <p className="text-xs text-outline mt-1">
                    Nobody owns this lead yet — it will be assigned to you.
                  </p>
                </Field>
              )}

              {isLost && (
                <Field label="Reason" icon="cancel">
                  <select
                    required
                    autoFocus
                    value={stageForm.lostReason}
                    onChange={(e) => setStageForm((f) => ({ ...f, lostReason: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">Select a reason…</option>
                    {lostReasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {lostReasons.length === 0 && (
                    <p className="text-xs text-error mt-1">
                      Couldn't load the reasons — reload the page and try again.
                    </p>
                  )}
                </Field>
              )}

              {needsFollowUp && (
                <Field label="Next Follow-up Date" icon="event">
                  <input
                    type="date"
                    required
                    min={today}
                    autoFocus={!needsOwner}
                    value={stageForm.nextFollowUpDate}
                    onChange={(e) => setStageForm((f) => ({ ...f, nextFollowUpDate: e.target.value }))}
                    className={inputCls}
                  />
                  <p className="text-xs text-outline mt-1">
                    The lead appears on the call list on this date.
                  </p>
                </Field>
              )}

              <Field label={isLost ? "Remarks" : "Remark"} icon="edit_note">
                <textarea
                  rows={3}
                  required
                  value={stageForm.remark}
                  onChange={(e) => setStageForm((f) => ({ ...f, remark: e.target.value }))}
                  placeholder={
                    isLost
                      ? "What happened? e.g. Went with a cheaper consultant, quoted 40k."
                      : "What was discussed, and what happens on the next call?"
                  }
                  className={`${inputCls} resize-none`}
                />
              </Field>

              {stageError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                  border border-error/20 rounded-lg text-body-sm text-error">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {stageError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setStage(null)}
                  className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                    text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stageLoading}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-body-md font-semibold
                    text-white hover:opacity-90 disabled:opacity-60 transition-all
                    ${isLost ? "bg-error" : "bg-primary"}`}
                >
                  {stageLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        {isLost ? "cancel" : "check_circle"}
                      </span>
                      {isLost ? "Mark Lost" : `Move to ${label}`}
                    </>
                  )}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {remarkLead && (
        <Modal onClose={() => setRemarkLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Remarks</h2>
              <p className="text-body-sm text-secondary mt-0.5">
                {remarkLead.companyName} · {remarkLead.status.replace(/_/g, " ")}
              </p>
            </div>
            <button
              onClick={() => setRemarkLead(null)}
              className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form onSubmit={handleRemarkSave} className="p-6 space-y-5">
            <Field label="Remark" icon="edit_note">
              <textarea
                rows={5}
                autoFocus
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                placeholder="What's going on with this lead?"
                className={`${inputCls} resize-none`}
              />
            </Field>

            {remarkLead.remarksUpdatedAt && (
              <p className="text-xs text-outline">
                Last updated {new Date(remarkLead.remarksUpdatedAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
                {remarkLead.remarksUpdatedBy ? ` by ${remarkLead.remarksUpdatedBy.split("@")[0]}` : ""}
              </p>
            )}

            {remarkError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                border border-error/20 rounded-lg text-body-sm text-error">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {remarkError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setRemarkLead(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={remarkSaving}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {remarkSaving ? "Saving…" : "Save Remark"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {followUpLead && (
        <Modal onClose={() => setFollowUpLead(null)}>
          <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
            <div>
              <h2 className="text-headline-md font-semibold text-on-surface">Follow-up</h2>
              <p className="text-body-sm text-secondary mt-0.5">
                {followUpLead.companyName} · {followUpLead.status.replace(/_/g, " ")}
              </p>
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
              Status wahi rahega. Date aur remark daal do — us din lead call list
              mein aa jayegi aur assigned user ko reminder mil jayega.
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

            <Field label="Remark" icon="edit_note">
              <textarea
                required
                rows={3}
                value={followUpRemarkInput}
                onChange={(e) => setFollowUpRemarkInput(e.target.value)}
                placeholder="e.g. Client said payment in 2 days"
                className={`${inputCls} resize-none`}
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
              {followUpLead.nextFollowUpDate && (
                <button
                  type="button"
                  disabled={followUpLoading}
                  onClick={handleFollowUpClear}
                  title="The call is done — take this lead off the follow-up list"
                  className="mr-auto px-4 py-2.5 text-body-md font-medium text-error
                    rounded-lg hover:bg-error/10 disabled:opacity-60 transition-all"
                >
                  Clear follow-up
                </button>
              )}
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
                    Save Follow-up
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