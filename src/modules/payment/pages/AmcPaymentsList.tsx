// src/modules/payment/pages/AmcPaymentsList.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Receipt } from "lucide-react";
import {
  amcService,
  type AmcProject,
} from "../../amc-frontend/services/amcService";
import {
  getAmcInvoiceSummary,
  searchInvoices,
  type AmcInvoiceSummaryResponse,
  type InvoiceResponse,
} from "../../../services/invoiceService";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import { getInvoiceDetailsById, type InvoiceDetailsResponse } from "../../../services/invoiceService";

export default function AmcPaymentsList() {
  const navigate = useNavigate();

  const [amcs, setAmcs] = useState<AmcProject[]>([]);
  const [summaries, setSummaries] = useState<Record<string, AmcInvoiceSummaryResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global "find any PI/TI" search — works across the whole Payments module,
  // not just AMC (covers the "reopen a client's PI to fix a mistake" workflow).
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InvoiceResponse[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);

  useEffect(() => {
    loadAmcs();
  }, []);

  const loadAmcs = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await amcService.getAllAmc();
      setAmcs(list);

      const summaryEntries = await Promise.all(
        list.map(async (amc: AmcProject) => {
          try {
            const summary = await getAmcInvoiceSummary(amc.id);
            return [amc.id, summary] as const;
          } catch {
            return [amc.id, null] as const;
          }
        })
      );

      const map: Record<string, AmcInvoiceSummaryResponse> = {};
      summaryEntries.forEach(([id, summary]) => {
        if (summary) map[id] = summary;
      });
      setSummaries(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load AMCs");
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading AMC records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AMC — Payments</h1>
        <p className="text-gray-600 mt-1">PI/TI issued against Annual Maintenance Contracts</p>
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

      {/* AMC list with PI/TI counts */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">All AMC Records</h3>
        </div>

        {amcs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No AMC records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">AMC Code</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Client</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">PI Issued</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">TI Issued</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Total Invoiced</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {amcs.map((amc) => {
                  const summary = summaries[amc.id];
                  return (
                    <tr key={amc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{amc.amcCode}</td>
                      <td className="px-6 py-4 text-gray-700">{amc.clientName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {amc.amcStatus}
                        </span>
                      </td>
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
                      <td className="px-6 py-4 text-right font-medium text-green-700">
                        ₹{(summary?.totalInvoicedAmount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(`/payments/amc/${amc.id}`)}
                          className="text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Manage →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
