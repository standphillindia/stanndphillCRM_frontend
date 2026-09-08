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
import { Search, FileText, Receipt, Plus } from "lucide-react";
import {
  getIndependentProjects,
  searchInvoices,
  getInvoiceDetailsById,
  type IndependentProjectResponse,
  type InvoiceResponse,
  type InvoiceDetailsResponse,
} from "../../../services/invoiceService";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import CreateIndependentProjectModal from "../../../components/invoice/CreateIndependentProjectModal";

export default function IndependentProjectsList() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<IndependentProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);

  // Global "find any PI/TI" search — same as the Project/AMC list pages.
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceResponse[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getIndependentProjects();
      setProjects(result);
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
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
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
        <div className="flex gap-2">
          <div className="relative flex-1">
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Project</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Contract</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Received</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Pending</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">PI</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">TI</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {p.projectName}
                      {p.certificationType && (
                        <p className="text-xs text-gray-500 font-normal">{p.certificationType}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{p.clientName}</td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(p.contractAmount)}</td>
                    <td className="px-6 py-4 text-right text-green-700">{formatCurrency(p.totalReceived)}</td>
                    <td className="px-6 py-4 text-right text-orange-700">{formatCurrency(p.totalPending)}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-orange-700">
                        <FileText size={14} /> {p.piCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Receipt size={14} /> {p.tiCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => navigate(`/payments/independent/${p.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateIndependentProjectModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            navigate(`/payments/independent/${created.id}`);
          }}
        />
      )}

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