// src/components/quotation/LinkQuotationModal.tsx
//
// Payments → lead → attach one of the existing, unlinked quotations.
//
// The reverse of LinkLeadModal, for Accounts: when a lead shows "—" in the
// Quotation column, they can find the quotation Sales raised without a
// lead and attach it here, instead of chasing the amount over chat.
// Quotations whose company name matches the lead are listed first.

import { useEffect, useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import {
  getAllQuotations,
  linkQuotationToLead,
  type QuotationResponse,
} from "../../services/quotationService";

interface Props {
  isOpen: boolean;
  leadId?: string;
  /** Lead's company name — used to put likely matches on top. */
  companyName?: string;
  onClose: () => void;
  onLinked: () => void;
}

const money = (v: number) => `₹${(v ?? 0).toLocaleString("en-IN")}`;

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-amber-100 text-amber-800",
};

/** Lower-case letters and digits only, so "Pvt. Ltd" and "PVT LTD" compare equal. */
const norm = (s?: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** First meaningful word of a company name — "yashplastics" → match on "yash". */
const firstWord = (s?: string) =>
  (s ?? "").toLowerCase().split(/[^a-z0-9]+/).find((w) => w.length >= 3) ?? "";

export default function LinkQuotationModal({ isOpen, leadId, companyName, onClose, onLinked }: Props) {
  const [all, setAll] = useState<QuotationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setError(null);
    setLoading(true);
    getAllQuotations()
      .then(setAll)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load quotations"))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const list = useMemo(() => {
    const target = norm(companyName);
    const word = firstWord(companyName);
    const isMatch = (q: QuotationResponse) => {
      const c = norm(q.clientCompany);
      return !!c && !!target && (c.includes(target) || target.includes(c) || (!!word && c.includes(word)));
    };
    const s = search.trim().toLowerCase();

    return all
      .filter((q) => !q.leadId)
      .filter(
        (q) =>
          !s ||
          q.offerNumber.toLowerCase().includes(s) ||
          (q.clientCompany ?? "").toLowerCase().includes(s) ||
          (q.kindAttention ?? "").toLowerCase().includes(s)
      )
      .map((q) => ({ q, match: isMatch(q) }))
      .sort((a, b) => Number(b.match) - Number(a.match) || b.q.offerDate.localeCompare(a.q.offerDate));
  }, [all, search, companyName]);

  if (!isOpen || !leadId) return null;

  const link = async (id: string) => {
    setSavingId(id);
    setError(null);
    try {
      await linkQuotationToLead(id, leadId);
      onLinked();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? "Could not link the quotation");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Link a quotation</h2>
            <p className="text-xs text-gray-500 mt-0.5">{companyName || "—"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by offer number, company or contact…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Only quotations not yet linked to any lead are listed. Likely matches are on top.
          </p>
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-sm">
            {error}
          </div>
        )}

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No unlinked quotations found. Ask Sales to raise one from the Quotations page.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
              {list.map(({ q, match }) => (
                <li key={q.id} className={`flex items-center gap-3 px-4 py-3 ${match ? "bg-indigo-50/50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{q.offerNumber}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[q.status] ?? ""}`}>
                        {q.status}
                      </span>
                      {match && (
                        <span className="text-[10px] font-semibold text-indigo-700">Likely match</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {q.clientCompany || "—"} · {q.kindAttention || "—"} · {q.certificationTypeLabel}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{money(q.totalInr)}</div>
                  <button
                    onClick={() => link(q.id)}
                    disabled={savingId !== null}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:bg-gray-400"
                  >
                    {savingId === q.id ? "Linking…" : "Link"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}