// src/pages/quotations/QuotationsPage.tsx
//
// The list. Until now quotations were Canva files in a folder, so nobody
// could say how many had gone out, how many came back, or which had
// quietly run past their 30-day validity. The counters at the top and the
// greyed-out expired rows are the whole point of this page.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Copy, Eye, Pencil, Trash2, Search, Link as LinkIcon, Upload, GitBranch } from "lucide-react";
import QuotationFormModal from "../../components/quotation/QuotationFormModal";
import QuotationPreviewModal from "../../components/quotation/QuotationPreviewModal";
import LinkLeadModal from "../../components/quotation/LinkLeadModal";
import UploadQuotationModal from "../../components/quotation/UploadQuotationModal";
import { fetchAMCLeadById } from "../../services/amcLeadService";
import {
  getAllQuotations,
  getQuotationById,
  duplicateQuotation,
  deleteQuotation,
  reviseQuotation,
  type CreateQuotationRequest,
  type QuotationDetailsResponse,
  type QuotationResponse,
} from "../../services/quotationService";

/** AMC quotation = the AMC type, or anything raised from AMC Leads. */
const isAmcQuotation = (r: QuotationResponse) => r.certificationType === "AMC" || Boolean(r.amcLeadId);

/** A quotation sent TO us (client / vendor) — kept on its own tab. */
const isReceived = (r: QuotationResponse) => r.entryType === "RECEIVED";
/** Uploaded or received: a file, edited through the upload form. */
const isFileRecord = (r: QuotationResponse) => Boolean(r.entryType);

type StatusFilter = "ALL" | "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-purple-100 text-purple-700",
};

/** What the status chip says — a received quotation has no status of ours. */
const statusText = (r: QuotationResponse) => (isReceived(r) ? "RECEIVED" : r.status);

export default function QuotationsPage() {
  const [rows, setRows] = useState<QuotationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationDetailsResponse | null>(null);
  const [preview, setPreview] = useState<QuotationDetailsResponse | null>(null);
  // Quotation being attached to (or moved between) leads.
  const [linking, setLinking] = useState<QuotationResponse | null>(null);
  // Upload form: a new upload, an uploaded record being edited, or a
  // revised version of a quotation being uploaded.
  const [upload, setUpload] = useState<{
    existing?: QuotationDetailsResponse | null;
    revisionOf?: QuotationResponse | null;
  } | null>(null);

  const [params, setParams] = useSearchParams();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getAllQuotations());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load quotations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Opened from the Leads page via /quotations?new=1&leadId=…
  useEffect(() => {
    if (params.get("new") === "1") {
      setEditing(null);
      setFormOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leadIdFromUrl = params.get("leadId") ?? undefined;

  // Opened from AMC Leads via /quotations?new=1&amcLeadId=… — an AMC
  // quotation for that lead, with the client block filled from the lead.
  const amcLeadIdFromUrl = params.get("amcLeadId") ?? undefined;
  const [amcPrefill, setAmcPrefill] = useState<Partial<CreateQuotationRequest> | undefined>(undefined);
  useEffect(() => {
    if (!amcLeadIdFromUrl) return;
    let cancelled = false;
    fetchAMCLeadById(amcLeadIdFromUrl)
      .then((l) => {
        if (cancelled) return;
        setAmcPrefill({
          amcLeadId: l.id,
          certificationType: "AMC",
          clientCompany: l.companyName ?? "",
          clientName: l.contactName ?? "",
          kindAttention: l.contactName ?? "",
          clientEmail: l.email ?? "",
          clientMobile: l.phone ?? "",
        });
      })
      .catch(() => {
        if (!cancelled) setAmcPrefill({ amcLeadId: amcLeadIdFromUrl, certificationType: "AMC" });
      });
    return () => {
      cancelled = true;
    };
  }, [amcLeadIdFromUrl]);

  // The AMC lead applies to the one quotation it was opened for — drop it
  // from the URL afterwards so the next "New Quotation" starts clean.
  const clearAmcLead = () => {
    if (!amcLeadIdFromUrl) return;
    params.delete("amcLeadId");
    setParams(params, { replace: true });
    setAmcPrefill(undefined);
  };

  // One stable object, so the form doesn't reset itself on every re-render.
  const leadPrefill = useMemo(
    () => (leadIdFromUrl ? { leadId: leadIdFromUrl } : undefined),
    [leadIdFromUrl]
  );

  // Sales and AMC quotations are kept apart: two tabs, each with its own
  // list and numbers. AMC = the AMC type, or anything raised from AMC Leads.
  // ?tab=amc (AMC Leads → "AMC Quotations") or coming from an AMC lead opens the AMC tab.
  // Received quotations (sent to us) get a third tab of their own.
  const [tab, setTab] = useState<"SALES" | "AMC" | "RECEIVED">(
    amcLeadIdFromUrl || params.get("tab") === "amc" ? "AMC" : params.get("tab") === "received" ? "RECEIVED" : "SALES"
  );
  const tabRows = useMemo(
    () =>
      rows.filter((r) =>
        tab === "RECEIVED" ? isReceived(r) : !isReceived(r) && (tab === "AMC") === isAmcQuotation(r)
      ),
    [rows, tab]
  );
  const amcCount = useMemo(() => rows.filter((r) => !isReceived(r) && isAmcQuotation(r)).length, [rows]);
  const receivedCount = useMemo(() => rows.filter(isReceived).length, [rows]);
  // "New Quotation" on the AMC tab starts as an AMC quotation.
  const amcTabPrefill = useMemo(() => ({ certificationType: "AMC" }), []);

  const stats = useMemo(() => {
    const by = (s: string) => tabRows.filter((r) => r.status === s).length;
    const accepted = by("ACCEPTED");
    const responded = accepted + by("REJECTED");
    return {
      total: tabRows.length,
      sent: tabRows.filter((r) => r.status !== "DRAFT").length,
      accepted,
      // Win rate over quotations the client actually answered — counting
      // still-open ones as losses would understate it badly.
      winRate: responded ? Math.round((accepted / responded) * 100) : null,
      expired: tabRows.filter((r) => r.status === "EXPIRED").length,
    };
  }, [tabRows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tabRows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.offerNumber.toLowerCase().includes(q) ||
        (r.clientCompany ?? "").toLowerCase().includes(q) ||
        (r.kindAttention ?? "").toLowerCase().includes(q) ||
        r.certificationTypeLabel.toLowerCase().includes(q)
      );
    });
  }, [tabRows, search, statusFilter]);

  const openPreview = async (id: string) => {
    try {
      setPreview(await getQuotationById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that quotation");
    }
  };

  const openEdit = async (id: string) => {
    try {
      const details = await getQuotationById(id);
      // Uploaded / received: a file plus a few details — its own form.
      if (details.entryType) {
        setUpload({ existing: details });
        return;
      }
      setEditing(details);
      setFormOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that quotation");
    }
  };

  /**
   * Copies a quotation into a fresh draft and drops the user straight into
   * the form with every block already filled. This is what replaces
   * "duplicate the Canva file and edit it" — the same habit, but the offer
   * number, dates and status are handled for them.
   */
  const handleDuplicate = async (id: string) => {
    try {
      const copy = await duplicateQuotation(id);
      await load();
      setEditing(copy);
      setFormOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not duplicate that quotation");
    }
  };

  /**
   * Revised quotation. One made in the CRM is copied into a new draft
   * (…/R1) and opened in the form; an uploaded / received one needs the
   * revised file, so the upload form opens.
   */
  const handleRevise = async (row: QuotationResponse) => {
    if (isFileRecord(row)) {
      setUpload({ revisionOf: row });
      return;
    }
    try {
      const revised = await reviseQuotation(row.id);
      await load();
      setEditing(revised);
      setFormOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the revised quotation");
    }
  };

  /** Draft — or any received quotation (only a copy of someone else's). */
  const canDelete = (r: QuotationResponse) => r.status === "DRAFT" || isReceived(r);

  const handleDelete = async (row: QuotationResponse) => {
    if (!window.confirm(`Delete ${isReceived(row) ? "received quotation" : "draft"} ${row.offerNumber}? This can't be undone.`)) return;
    try {
      await deleteQuotation(row.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that quotation");
    }
  };

  const money = (v: number) => `₹${(v ?? 0).toLocaleString("en-IN")}`;
  const date = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <div className="p-0 lg:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-4 lg:mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Quotations</h1>
          <p className="text-gray-500 text-sm mt-1">
            {stats.total} total · {stats.sent} sent to clients
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Quotation made outside the CRM, or one received from a client /
              vendor — saved here as a normal quotation record. */}
          <button
            onClick={() => setUpload({})}
            className="flex items-center gap-2 px-4 py-2.5 border border-indigo-300 text-indigo-700 hover:bg-indigo-50 bg-white rounded-lg font-medium"
          >
            <Upload size={18} /> Upload Quotation
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium"
          >
            <Plus size={18} /> New Quotation
          </button>
        </div>
      </div>

      {/* Sales / AMC quotations — kept apart */}
      <div className="flex gap-1 border-b mb-5">
        {([
          ["SALES", "Sales quotations", rows.length - amcCount - receivedCount],
          ["AMC", "AMC quotations", amcCount],
          ["RECEIVED", "Received", receivedCount],
        ] as const)
          // The Received tab only appears once such records exist.
          .filter(([key]) => key !== "RECEIVED" || receivedCount > 0 || tab === "RECEIVED")
          .map(([key, text, n]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === key ? "border-indigo-600 text-indigo-700" : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            {text} <span className="text-xs text-gray-400">({n})</span>
          </button>
        ))}
      </div>

      {tab === "RECEIVED" && (
        <p className="text-sm text-gray-600 mb-4">
          Quotations sent <b>to us</b> — a client's counter offer or PO, a lab's or vendor's rate. Kept for the
          record; they don't count in our win rate.
        </p>
      )}

      {tab !== "RECEIVED" && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Sent to clients" value={stats.sent} />
        <StatCard label="Accepted" value={stats.accepted} tone="green" />
        <StatCard
          label="Win rate"
          value={stats.winRate === null ? "—" : `${stats.winRate}%`}
          hint="of quotations the client answered"
        />
        <StatCard label="Expired unanswered" value={stats.expired} tone="amber" />
      </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-3 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search by offer number, company or contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="ALL">Status: All</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* Phone / tablet: one card per quotation. The table is for laptops. */}
      <div className="lg:hidden space-y-2.5">
        {loading && <p className="py-8 text-center text-gray-500 text-sm">Loading…</p>}
        {!loading && visible.length === 0 && (
          <p className="py-8 text-center text-gray-500 text-sm">
            {rows.length === 0 ? "No quotations yet." : "Nothing matches that filter."}
          </p>
        )}
        {!loading &&
          visible.map((r) => (
            <div key={r.id} className={`bg-white border border-gray-200 rounded-xl p-4 ${r.expired ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-gray-900 text-[15px] break-all">{r.offerNumber}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_STYLES[statusText(r)] ?? "bg-gray-100 text-gray-700"}`}>
                  {statusText(r)}
                </span>
              </div>
              <RecordTags r={r} />
              <div className="mt-1 text-sm text-gray-800">{r.clientCompany || "—"}</div>
              {r.kindAttention && <div className="text-xs text-gray-500">{r.kindAttention}</div>}
              {!r.leadId && !r.independentProjectId && !isAmcQuotation(r) && !isReceived(r) && (
                <div className="text-[11px] font-medium text-amber-700">Not linked to a lead</div>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>{r.certificationTypeLabel}</span>
                <span>📅 {date(r.offerDate)}</span>
                <span className={r.expired ? "text-amber-700 font-medium" : ""}>Valid till {date(r.validUntil)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">Amount</span>
                <span className="text-base font-bold text-gray-900">{money(r.totalInr)}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
                <button onClick={() => openPreview(r.id)} className="py-2.5 rounded-xl bg-indigo-600 text-white">
                  {r.fileName ? "View / Download" : "View / Download PDF"}
                </button>
                {(isFileRecord(r) || r.status === "DRAFT" || r.status === "SENT" || r.status === "EXPIRED") ? (
                  <button onClick={() => openEdit(r.id)} className="py-2.5 rounded-xl border border-indigo-200 text-indigo-700">
                    Edit
                  </button>
                ) : (
                  <button onClick={() => handleDuplicate(r.id)} className="py-2.5 rounded-xl border border-indigo-200 text-indigo-700">
                    Duplicate
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium">
                {!isFileRecord(r) && (r.status === "DRAFT" || r.status === "SENT" || r.status === "EXPIRED") && (
                  <button onClick={() => handleDuplicate(r.id)} className="text-indigo-700">Duplicate</button>
                )}
                <button onClick={() => handleRevise(r)} className="text-indigo-700">
                  {isFileRecord(r) ? "Upload revised" : "Revise"}
                </button>
                {!isAmcQuotation(r) && (
                  <button onClick={() => setLinking(r)} className={r.leadId ? "text-green-700" : "text-amber-700"}>
                    {r.leadId ? "Change linked lead" : "Link to lead"}
                  </button>
                )}
                {canDelete(r) && (
                  <button onClick={() => handleDelete(r)} className="text-red-600">
                    {isReceived(r) ? "Delete" : "Delete draft"}
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <Th>Offer No.</Th>
              <Th>Client</Th>
              <Th>Type</Th>
              <Th>Date</Th>
              <Th>Valid Until</Th>
              <Th className="text-right">Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            )}

            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  {rows.length === 0
                    ? "No quotations yet. Create your first one — after that, Duplicate will save you most of the typing."
                    : "Nothing matches that filter."}
                </td>
              </tr>
            )}

            {!loading &&
              visible.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 ${
                    r.expired ? "opacity-60" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.offerNumber}
                    <RecordTags r={r} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-900">{r.clientCompany || "—"}</div>
                    <div className="text-xs text-gray-500">{r.kindAttention}</div>
                    {r.amcLeadId && (
                      <div className="text-[11px] font-medium text-green-700">AMC lead</div>
                    )}
                    {!r.leadId && !r.independentProjectId && !isAmcQuotation(r) && !isReceived(r) && (
                      <div className="text-[11px] font-medium text-amber-700">Not linked to a lead</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.certificationTypeLabel}</td>
                  <td className="px-4 py-3 text-gray-600">{date(r.offerDate)}</td>
                  <td className={`px-4 py-3 ${r.expired ? "text-amber-700 font-medium" : "text-gray-600"}`}>
                    {date(r.validUntil)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{money(r.totalInr)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_STYLES[statusText(r)] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statusText(r)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <IconBtn title="Preview / Download" onClick={() => openPreview(r.id)}>
                        <Eye size={16} />
                      </IconBtn>
                      {/* Sales leads only — an AMC quotation belongs to its AMC lead. */}
                      {!isAmcQuotation(r) && (
                        <IconBtn
                          title={r.leadId ? "Change linked lead" : "Link to lead"}
                          onClick={() => setLinking(r)}
                        >
                          <LinkIcon size={16} className={r.leadId ? "text-green-600" : "text-amber-600"} />
                        </IconBtn>
                      )}
                      {!isFileRecord(r) && (
                        <IconBtn title="Duplicate" onClick={() => handleDuplicate(r.id)}>
                          <Copy size={16} />
                        </IconBtn>
                      )}
                      <IconBtn
                        title={isFileRecord(r) ? "Upload revised quotation" : "Revise (new version, same client)"}
                        onClick={() => handleRevise(r)}
                      >
                        <GitBranch size={16} />
                      </IconBtn>
                      {(isFileRecord(r) || r.status === "DRAFT" || r.status === "SENT" || r.status === "EXPIRED") && (
                        <IconBtn title="Edit" onClick={() => openEdit(r.id)}>
                          <Pencil size={16} />
                        </IconBtn>
                      )}
                      {canDelete(r) && (
                        <IconBtn title={isReceived(r) ? "Delete" : "Delete draft"} danger onClick={() => handleDelete(r)}>
                          <Trash2 size={16} />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <QuotationFormModal
        isOpen={formOpen}
        existing={editing}
        prefill={amcLeadIdFromUrl ? amcPrefill : tab === "AMC" && !leadPrefill ? amcTabPrefill : leadPrefill}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          clearAmcLead();
        }}
        onSaved={(saved) => {
          setFormOpen(false);
          setEditing(null);
          clearAmcLead();
          load();
          setPreview(saved);
        }}
      />

      {upload !== null && (
      <UploadQuotationModal
        isOpen
        existing={upload?.existing ?? null}
        revisionOf={upload?.revisionOf ?? null}
        defaultEntryType="UPLOADED"
        quotations={rows}
        defaultCertificationType={tab === "AMC" ? "AMC" : undefined}
        leadId={leadIdFromUrl ?? undefined}
        amcLeadId={amcLeadIdFromUrl ?? undefined}
        onClose={() => setUpload(null)}
        onSaved={(saved) => {
          setUpload(null);
          clearAmcLead();
          load();
          setPreview(saved);
        }}
      />
      )}

      <LinkLeadModal
        quotation={linking}
        onClose={() => setLinking(null)}
        onLinked={() => {
          setLinking(null);
          load();
        }}
      />

      <QuotationPreviewModal
        quotation={preview}
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        onUpdated={(updated) => {
          setPreview(updated);
          load();
        }}
      />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase ${className}`}>
      {children}
    </th>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-gray-200 ${
        danger ? "text-red-600 hover:text-red-800" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: "green" | "amber";
  hint?: string;
}) {
  const colour =
    tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : "text-gray-900";
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${colour}`}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

/** Small tags under the number: uploaded file / revision. */
function RecordTags({ r }: { r: QuotationResponse }) {
  if (!r.entryType && !r.revisionNo) return null;
  return (
    <div className="mt-0.5 flex flex-wrap gap-1">
      {r.entryType === "UPLOADED" && (
        <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 text-[10px] font-semibold">📎 Uploaded</span>
      )}
      {r.entryType === "RECEIVED" && (
        <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">📥 Received</span>
      )}
      {r.revisionNo ? (
        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
          Revision {r.revisionNo}
        </span>
      ) : null}
    </div>
  );
}