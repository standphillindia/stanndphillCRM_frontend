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
import { FileText, Link as LinkIcon } from "lucide-react";
import { getFinanceLeads, type LeadResponse } from "../../../services/leadService";
import QuotationLookupModal from "../../../components/quotation/QuotationLookupModal";
import LinkQuotationModal from "../../../components/quotation/LinkQuotationModal";
import {
  getAllQuotations,
  type QuotationResponse,
} from "../../../services/quotationService";

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

  // Quotations are fetched once for the whole page and grouped by lead,
  // rather than one request per row. There are only ever a handful of them,
  // and a per-row call would fire dozens of requests just to decide whether
  // to show an icon.
  const [quotationsByLead, setQuotationsByLead] = useState<Record<string, number>>({});
  const [lookupLead, setLookupLead] = useState<LeadResponse | null>(null);
  // Lead whose missing quotation is being attached from the list of
  // unlinked ones (quotations Sales raised without picking the lead).
  const [linkLead, setLinkLead] = useState<LeadResponse | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend now returns only finance-pipeline statuses; the local
      // filter stays as a safety net if statuses ever drift.
      const all = await getFinanceLeads();
      setLeads(all.filter((l) => FINANCE_RELEVANT_STATUSES.includes(l.status)));

      // Counted here so the icon only appears where a quotation actually
      // exists — a dead icon on every row teaches people to ignore it.
      // A failure is swallowed deliberately: no quotation counts is a
      // missing convenience, not a reason to break the payments page.
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
    <div className="p-0 lg:p-6 space-y-4 lg:space-y-6">
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
          <>
          {/* Phone / tablet: one card per lead. The table is for laptops. */}
          <div className="lg:hidden divide-y divide-gray-200">
            {filtered.map((lead) => (
              <div key={lead.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-gray-900 break-words">{lead.companyName || lead.contactName || "—"}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[lead.status] || "bg-gray-100 text-gray-800"}`}>
                    {lead.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-gray-500 break-words">{[lead.contactName, lead.email].filter(Boolean).join(" · ")}</p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                  <span>{lead.certificationType || lead.product || "—"}</span>
                  <span>👤 {lead.assignedToEmail}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
                  {quotationsByLead[lead.id] ? (
                    <button onClick={() => setLookupLead(lead)} className="py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700">
                      Quotation{quotationsByLead[lead.id] > 1 ? ` (${quotationsByLead[lead.id]})` : ""}
                    </button>
                  ) : (
                    <button
                      onClick={() => setLinkLead(lead)}
                      className={`py-2.5 rounded-xl border ${
                        lead.status === "NEGOTIATION" || lead.status === "PI_RAISED"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-gray-200 bg-white text-gray-600"
                      }`}
                    >
                      Link quotation
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/payments/lead/${lead.id}`)}
                    className="py-2.5 rounded-xl text-white bg-blue-600"
                  >
                    {lead.status === "NEGOTIATION" ? "Raise PI →" : "Manage →"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Lead</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Product</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Sales Owner</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Quotation</th>
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
                    {/* What Sales actually quoted, one click from the Raise
                        PI button — so the PI is built from the document the
                        client received rather than from memory. */}
                    <td className="px-6 py-4 text-center">
                      {quotationsByLead[lead.id] ? (
                        <button
                          onClick={() => setLookupLead(lead)}
                          title="View the quotation sent to this client"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100"
                        >
                          <FileText size={14} />
                          {quotationsByLead[lead.id] > 1 ? quotationsByLead[lead.id] : "View"}
                        </button>
                      ) : (
                        // No quotation linked yet. Accounts can attach the
                        // one Sales raised without a lead; red once the PI
                        // is due, because that's when it's needed.
                        <button
                          onClick={() => setLinkLead(lead)}
                          title="No quotation linked to this lead — link the one Sales raised"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                            lead.status === "NEGOTIATION" || lead.status === "PI_RAISED"
                              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                          }`}
                        >
                          <LinkIcon size={13} />
                          Link
                        </button>
                      )}
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
          </>
        )}
      </div>

      <LinkQuotationModal
        isOpen={linkLead !== null}
        leadId={linkLead?.id}
        companyName={linkLead?.companyName}
        onClose={() => setLinkLead(null)}
        onLinked={() => {
          setLinkLead(null);
          load();
        }}
      />

      <QuotationLookupModal
        isOpen={lookupLead !== null}
        leadId={lookupLead?.id}
        clientLabel={
          lookupLead
            ? [lookupLead.companyName, lookupLead.contactName].filter(Boolean).join(" · ")
            : undefined
        }
        onClose={() => setLookupLead(null)}
      />
    </div>
  );
}