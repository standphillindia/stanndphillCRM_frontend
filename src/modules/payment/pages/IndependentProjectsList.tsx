// src/modules/payment/pages/IndependentProjectsList.tsx
//
// "Payments -> Independent" page — for the 100+ legacy/external projects
// that pre-date the CRM and aren't tracked as a real Project/AMC/Lead.
// Direct mirror of ProjectPaymentsList.tsx, except getIndependentProjects()
// already returns totalReceived/totalPending/piCount/tiCount inline (no
// need for a separate per-row summary fetch like the real Projects list
// needs).

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Receipt, Plus, Pencil, Trash2 } from "lucide-react";
import {
  getIndependentProjects,
  getIndependentProjectById,
  deleteIndependentProject,
  searchInvoices,
  getInvoiceDetailsById,
  type IndependentProjectResponse,
  type InvoiceResponse,
  type InvoiceDetailsResponse,
} from "../../../services/invoiceService";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import CreateIndependentProjectModal from "../../../components/invoice/CreateIndependentProjectModal";

// Names longer than this get a "Read more" toggle (about 2 lines of the column).
const NAME_CLAMP_CHARS = 60;

export default function IndependentProjectsList() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<IndependentProjectResponse[]>([]);
  // Rows whose long project name is shown in full ("Read more").
  const [expandedNames, setExpandedNames] = useState<Set<string>>(new Set());
  const toggleName = (id: string) =>
    setExpandedNames((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // The list row is a summary — editing needs the full record, so it's
  // fetched on demand rather than held for every row up front.
  const [editing, setEditing] = useState<Awaited<
    ReturnType<typeof getIndependentProjectById>
  > | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Global "find any PI/TI" search — same as the Project/AMC list pages.
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceResponse[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const handleEdit = async (id: string) => {
    setBusyId(id);
    try {
      setEditing(await getIndependentProjectById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that record");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (p: IndependentProjectResponse) => {
    if (!window.confirm(`Delete "${p.projectName}"? This can't be undone.`)) return;

    setBusyId(p.id);
    try {
      await deleteIndependentProject(p.id);
      await loadProjects();
    } catch (err) {
      // The backend refuses while invoices exist and says why — surface
      // that message rather than a generic failure.
      setError(err instanceof Error ? err.message : "Could not delete that record");
    } finally {
      setBusyId(null);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIndependentProjects();
      // Newest first (the backend sends them this way too).
      setProjects(
        [...result].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load independent projects");
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
          <p className="text-gray-600">Loading independent projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 lg:gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Independent Projects</h1>
          <p className="text-gray-600 mt-1">
            PI/TI for legacy or external work not tracked as a Project/AMC/Lead in the CRM.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
        >
          <Plus size={16} /> New Independent Record
        </button>
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
              placeholder="e.g. Agarwalla or PI-2026-0048"
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

      {/* Independent projects list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">All Independent Records</h3>
        </div>

        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No independent records yet. Click "New Independent Record" to add legacy/external work.
          </div>
        ) : (
          <>
          {/* Phone / tablet: one card per record. The table is for laptops. */}
          <div className="lg:hidden divide-y divide-gray-200">
            {projects.map((p) => (
              <div key={p.id} className="p-4">
                <p
                  title={p.projectName}
                  className={`font-bold text-gray-900 break-words ${expandedNames.has(p.id) ? "" : "line-clamp-2"}`}
                >
                  {p.projectName}
                </p>
                {(p.projectName?.length ?? 0) > NAME_CLAMP_CHARS && (
                  <button type="button" onClick={() => toggleName(p.id)} className="text-xs font-medium text-blue-600">
                    {expandedNames.has(p.id) ? "Show less" : "Read more"}
                  </button>
                )}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  {p.clientName && <span>{p.clientName}</span>}
                  {p.certificationType && <span>{p.certificationType}</span>}
                  {p.createdAt && (
                    <span>📅 {new Date(p.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-")}</span>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Contract</span><b className="text-gray-900">{p.contractAmount ? formatCurrency(p.contractAmount) : "Not set"}</b></div>
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Received</span><b className="text-green-700">{formatCurrency(p.totalReceived)}</b></div>
                  <div className="rounded-lg bg-gray-50 px-2 py-1.5"><span className="block text-gray-500">Pending</span><b className="text-orange-700">{formatCurrency(p.totalPending)}</b></div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="inline-flex items-center gap-1 text-orange-700"><FileText size={13} /> PI {p.piCount}</span>
                  <span className="inline-flex items-center gap-1 text-blue-700"><Receipt size={13} /> TI {p.tiCount}</span>
                  <button
                    disabled={busyId === p.id}
                    onClick={() => handleEdit(p.id)}
                    className="ml-auto font-semibold text-gray-700 disabled:opacity-40"
                  >
                    Edit
                  </button>
                  {p.piCount + p.tiCount === 0 && (
                    <button
                      disabled={busyId === p.id}
                      onClick={() => handleDelete(p)}
                      className="font-semibold text-red-600 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/payments/independent/${p.id}`)}
                  className="mt-3 w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600"
                >
                  View PI / TI
                </button>
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Project</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Created</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Contract</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">Pending</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">PI</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">TI</th>
                  {/* Action stays pinned on the right, so Edit / Delete are visible
                      even when the table is wider than the screen. */}
                  <th className="sticky right-0 z-10 bg-gray-50 px-4 py-3 text-center font-semibold text-gray-700 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p) => (
                  <tr key={p.id} className="group hover:bg-gray-50">
                    <td className="px-4 py-4 font-medium text-gray-900 min-w-[220px] max-w-[340px]">
                      {/* Long names (a whole scope line) are cut to 2 lines
                          with "Read more"; the full name is also on hover. */}
                      <p
                        title={p.projectName}
                        className={`break-words ${expandedNames.has(p.id) ? "" : "line-clamp-2"}`}
                      >
                        {p.projectName}
                      </p>
                      {(p.projectName?.length ?? 0) > NAME_CLAMP_CHARS && (
                        <button
                          type="button"
                          onClick={() => toggleName(p.id)}
                          className="mt-0.5 text-xs font-medium text-blue-600 hover:underline"
                        >
                          {expandedNames.has(p.id) ? "Show less" : "Read more"}
                        </button>
                      )}
                      {p.certificationType && (
                        <p className="text-xs text-gray-500 font-normal">{p.certificationType}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-700">{p.clientName}</td>
                    {/* When the record was created (India time). */}
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {p.createdAt ? (
                        <>
                          {new Date(p.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, "-")}
                          <span className="block text-xs text-gray-400">
                            {new Date(p.createdAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900">{p.contractAmount ? formatCurrency(p.contractAmount) : <span className="text-gray-400">Not set</span>}</td>
                    <td className="px-4 py-4 text-right text-green-700">{formatCurrency(p.totalReceived)}</td>
                    <td className="px-4 py-4 text-right text-orange-700">{formatCurrency(p.totalPending)}</td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-orange-700">
                        <FileText size={14} /> {p.piCount}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Receipt size={14} /> {p.tiCount}
                      </span>
                    </td>
                    <td className="sticky right-0 bg-white group-hover:bg-gray-50 px-4 py-4 shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.15)]">
                      <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/payments/independent/${p.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View →
                        </button>
                        <button
                          title="Edit record"
                          disabled={busyId === p.id}
                          onClick={() => handleEdit(p.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-gray-700 hover:text-gray-900 hover:bg-gray-200 disabled:opacity-40 font-medium"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          title={
                            p.piCount + p.tiCount > 0
                              ? "Has invoices — delete those first"
                              : "Delete record"
                          }
                          disabled={busyId === p.id || p.piCount + p.tiCount > 0}
                          onClick={() => handleDelete(p)}
                          className="p-1.5 rounded text-red-600 hover:text-red-800 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <CreateIndependentProjectModal
        isOpen={showCreateModal || editing !== null}
        existing={editing}
        onClose={() => {
          setShowCreateModal(false);
          setEditing(null);
        }}
        onCreated={(saved) => {
          // A new record drops you straight into it to raise the first PI.
          // An edit stays put — you came here to fix a number, not to
          // navigate away from the list you were checking.
          if (editing) {
            setEditing(null);
            loadProjects();
          } else {
            setShowCreateModal(false);
            navigate(`/payments/independent/${saved.id}`);
          }
        }}
      />

      {previewInvoice && (
        <AmcInvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          onUpdated={(updated) => setPreviewInvoice(updated)}
        />
      )}
    </div>
  );
}