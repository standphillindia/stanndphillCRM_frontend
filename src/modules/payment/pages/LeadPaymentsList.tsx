// src/modules/payment/pages/LeadPaymentsList.tsx
//
// Payments -> Leads. This is where the pre-WON finance flow's PI/TI work
// actually happens — deliberately kept out of the Leads (Sales) page.
// Sales only moves a lead into NEGOTIATION; from there it's Finance's job
// (via this page) to raise the PI, and later generate the TI once payment
// is confirmed. Every status change after that (PI_RAISED, PAYMENT_RECEIVED,
// READY_TO_WON) still happens automatically — see LeadFinanceFlowService.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminLeads, type LeadResponse } from "../../../services/leadService";

const FINANCE_RELEVANT_STATUSES = ["NEGOTIATION", "PI_RAISED", "PAYMENT_RECEIVED", "READY_TO_WON"];

const STATUS_STYLES: Record<string, string> = {
  NEGOTIATION: "bg-purple-100 text-purple-800",
  PI_RAISED: "bg-orange-100 text-orange-800",
  PAYMENT_RECEIVED: "bg-teal-100 text-teal-800",
  READY_TO_WON: "bg-lime-100 text-lime-800",
};

export default function LeadPaymentsList() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState<LeadResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAdminLeads();
      setLeads(all.filter((l) => FINANCE_RELEVANT_STATUSES.includes(l.status)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return l.companyName?.toLowerCase().includes(q) || l.contactName?.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads — Pre-WON Finance</h1>
        <p className="text-gray-600 mt-1">
          Raise the PI here once a lead reaches Negotiation. Record the client's payment, then generate the
          TI — the lead moves itself to Ready-to-Won automatically, and shows up in Admin's task list.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <input
          type="text"
          placeholder="Search by company or contact name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No leads waiting on finance right now. New ones appear here the moment Sales moves a lead to
            Negotiation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Lead</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Sales Owner</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{lead.companyName}</p>
                      <p className="text-xs text-gray-500">{lead.contactName} · {lead.email}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{lead.certificationType || lead.product || "—"}</td>
                    <td className="px-6 py-4 text-gray-700">{lead.assignedToEmail}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[lead.status] || "bg-gray-100 text-gray-800"}`}>
                        {lead.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => navigate(`/payments/lead/${lead.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        {lead.status === "NEGOTIATION" ? "Raise PI →" : "Manage →"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}