// src/modules/payment/pages/ProjectPaymentsList.tsx
//
// Replaces the old Deal-based PaymentList.tsx. This is the main
// "Payments -> List" page — direct mirror of AmcPaymentsList.tsx, just
// listing Projects (with their own PI/TI + received/pending) instead of
// AMC contracts. A Lead going WON now creates a Project directly (no more
// Deal in between), so this is where all Project billing lives.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Receipt, Pencil } from "lucide-react";
import { fetchProjectsForPayments, type ProjectResponse } from "../../../services/projectService";
import {
  getProjectInvoiceSummary,
  searchInvoices,
  type ProjectInvoiceSummaryResponse,
  type InvoiceResponse,
  type InvoiceDetailsResponse,
  getInvoiceDetailsById,
} from "../../../services/invoiceService";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import QuotationLookupModal from "../../../components/quotation/QuotationLookupModal";
import {
  getAllQuotations,
  type QuotationResponse,
} from "../../../services/quotationService";
import ClampText from "../../../components/common/ClampText";
import EditContractModal from "../components/EditContractModal";

const STAGE_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PROJECT_CREATED: "bg-green-100 text-green-800",
  CLOSED: "bg-slate-200 text-slate-700",
};

export default function ProjectPaymentsList() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProjectInvoiceSummaryResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global "find any PI/TI" search — works across the whole Payments
  // module (AMC or Project), covers the "reopen a client's PI to fix a
  // mistake" workflow.
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceResponse[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);

  // Quotations hang off the originating Lead, not the Project — a project
  // created from a won lead carries that lead's id, which is what lets
  // Accounts trace a live project back to the paperwork that started it.
  // Fetched once for the page and grouped, rather than per row.
  const [quotationsByLead, setQuotationsByLead] = useState<Record<string, number>>({});
  const [lookupProject, setLookupProject] = useState<ProjectResponse | null>(null);
  // Contract amount being set by hand (pencil next to Contract).
  const [editingContract, setEditingContract] = useState<ProjectResponse | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      // Payments needs every project regardless of stage, so pull a large
      // page rather than the default paginated view.
      const result = await fetchProjectsForPayments({ page: 0, size: 200, sortBy: "createdAt", sortDir: "desc" });
      setProjects(result.content);

      const summaryEntries = await Promise.all(
        result.content.map(async (p: ProjectResponse) => {
          try {
            const summary = await getProjectInvoiceSummary(p.id);
            return [p.id, summary] as const;
          } catch {
            return [p.id, null] as const;
          }
        })
      );

      const map: Record<string, ProjectInvoiceSummaryResponse> = {};
      summaryEntries.forEach(([id, summary]) => {
        if (summary) map[id] = summary;
      });
      setSummaries(map);

      // Swallowed on failure by design: the icon is a convenience, and
      // losing it should never take the payments page down with it.
      try {
        const quotations: QuotationResponse[] = await getAllQuotations();
        const counts: Record<string, number> = {};
        quotations.forEach((q) => {
          if (q.leadId) counts[q.leadId] = (counts[q.leadId] ?? 0) + 1;
        });
        setQuotationsByLead(counts);
      } catch {
        setQuotationsByLead({});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchInvoices(query.trim());
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const openInvoicePreview = async (invoiceId: string) => {
    try {
      const details = await getInvoiceDetailsById(invoiceId);
      setPreviewInvoice(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open invoice");
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return "₹0";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 lg:p-6 space-y-4 lg:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-gray-600 mt-1">PI/TI issued against Projects — Received/Pending live-tracked per project</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Global invoice search */}
      <form onSubmit={handleSearch} className="bg-white border border-gray-200 rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Find any PI / TI (search by client name or invoice number)
        </label>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-full sm:min-w-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Samsung or PI-2026-0048"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" disabled={searching}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {searching ? "Searching..." : "Search"}
          </button>
          {searchResults !== null && (
            <button type="button" onClick={() => { setSearchResults(null); setQuery(""); }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
              Clear
            </button>
          )}
        </div>

        {searchResults !== null && (
          <div className="mt-4 border-t pt-4">
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-500">No invoices found matching "{query}".</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map((inv) => (
                  <div key={inv.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{inv.invoiceNumber} — {inv.clientName}</p>
                      <p className="text-xs text-gray-500">
                        {inv.invoiceType} · {inv.status} · ₹{inv.totalAmount?.toLocaleString()}
                      </p>
                    </div>
                    <button onClick={() => openInvoicePreview(inv.id)}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                      Open →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Project list with PI/TI counts + live received/pending */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">All Projects</h3>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No projects found.</div>
        ) : (
          <>
          {/* Phone / tablet: one card per project. The table is for laptops. */}
          <div className="lg:hidden divide-y divide-gray-200">
            {projects.map((p) => {
              const summary = summaries[p.id];
              return (
                <div key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <ClampText text={p.projectName} className="font-bold text-gray-900" />
                    {p.certificationType && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">{p.certificationType}</span>
                    )}
                  </div>
                  <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${STAGE_STYLES[p.stage] || "bg-blue-100 text-blue-800"}`}>
                    {p.stage}
                  </span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEditingContract(p); }} className="text-left rounded-lg bg-gray-50 px-2 py-1.5"><span className="flex items-center gap-1 text-gray-500">Contract <Pencil size={11} className="text-indigo-600" /></span><b className="text-gray-900">{formatCurrency(p.amount)}</b></button>
                      <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Received</span><b className="text-green-700">{formatCurrency(p.receivedAmount)}</b></div>
                      <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Pending</span><b className="text-orange-700">{formatCurrency(p.pendingAmount)}</b></div>
                    </div>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="inline-flex items-center gap-1 text-orange-700"><FileText size={13} /> PI {summary?.totalProforma ?? 0}</span>
                    <span className="inline-flex items-center gap-1 text-blue-700"><Receipt size={13} /> TI {summary?.totalTax ?? 0}</span>
                    {p.leadId && quotationsByLead[p.leadId] ? (
                      <button onClick={() => setLookupProject(p)} className="ml-auto font-semibold text-indigo-700">
                        Quotation{quotationsByLead[p.leadId] > 1 ? ` (${quotationsByLead[p.leadId]})` : ""}
                      </button>
                    ) : null}
                  </div>
                  <button
                    onClick={() => navigate(`/payments/project/${p.id}`)}
                    className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600"
                  >
                    View PI / TI
                  </button>
                </div>
              );
            })}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Project</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Certification</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Stage</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Contract</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Received</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Pending</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">PI</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">TI</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Quotation</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p) => {
                  const summary = summaries[p.id];
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900 min-w-[200px] max-w-[320px]">
                        <ClampText text={p.projectName} />
                      </td>
                      <td className="px-6 py-4 text-gray-700">{p.certificationType || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STAGE_STYLES[p.stage] || "bg-blue-100 text-blue-800"}`}>
                          {p.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                        <button
                          type="button"
                          title="Edit contract amount"
                          onClick={(e) => { e.stopPropagation(); setEditingContract(p); }}
                          className="ml-1.5 p-1 rounded text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 align-middle"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right text-green-700 font-medium">{formatCurrency(p.receivedAmount)}</td>
                      <td className="px-6 py-4 text-right text-orange-700 font-medium">{formatCurrency(p.pendingAmount)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-orange-700">
                          <FileText size={14} /> {summary?.totalProforma ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 text-blue-700">
                          <Receipt size={14} /> {summary?.totalTax ?? 0}
                        </span>
                      </td>
                      {/* Traced through the originating lead. Projects created
                          manually have no lead, so no quotation to show. */}
                      <td className="px-6 py-4 text-center">
                        {p.leadId && quotationsByLead[p.leadId] ? (
                          <button
                            onClick={() => setLookupProject(p)}
                            title="View the quotation this project came from"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                          >
                            <FileText size={14} />
                            {quotationsByLead[p.leadId] > 1 ? quotationsByLead[p.leadId] : "View"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/payments/project/${p.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <QuotationLookupModal
        isOpen={lookupProject !== null}
        leadId={lookupProject?.leadId}
        clientLabel={lookupProject?.projectName}
        onClose={() => setLookupProject(null)}
      />

      {previewInvoice && (
        <AmcInvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          onUpdated={(updated) => setPreviewInvoice(updated)}
        />
      )}
      {editingContract && (
        <EditContractModal
          projectId={editingContract.id}
          projectName={editingContract.projectName}
          currentAmount={editingContract.amount}
          onClose={() => setEditingContract(null)}
          onSaved={() => {
            setEditingContract(null);
            loadProjects();
          }}
        />
      )}
    </div>
  );
}