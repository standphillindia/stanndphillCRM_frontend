// src/components/quotation/QuotationLookupModal.tsx
//
// Read-only quotation lookup for the finance pages.
//
// Accounts raise the PI from what Sales agreed with the client, but until
// now the quotation itself lived outside the CRM — so the amounts were
// taken on trust, or chased over chat. This opens the actual document that
// went out, right next to the Raise PI button.
//
// Read-only on purpose: Accounts needs to *see* what was quoted, not to
// change its status. Marking a quotation Sent or Accepted stays with the
// person who owns the client conversation.

import { useEffect, useState } from "react";
import { X, FileText, Download } from "lucide-react";
import QuotationPreviewModal from "./QuotationPreviewModal";
import {
  getQuotationsByLead,
  getQuotationsByAmcLead,
  getQuotationById,
  type QuotationDetailsResponse,
  type QuotationResponse,
} from "../../services/quotationService";

interface Props {
  isOpen: boolean;
  onClose: () => void;

  /** Whose quotations to show. Null closes the lookup with a clear reason. */
  leadId?: string | null;

  /** Shown in the header so the user knows whose paperwork they're reading. */
  clientLabel?: string;

  /** AMC Leads page: show this AMC lead's quotations instead (leadId left empty). */
  amcLeadId?: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-amber-100 text-amber-800",
};

const money = (v: number) => `₹${(v ?? 0).toLocaleString("en-IN")}`;

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function QuotationLookupModal({
  isOpen,
  onClose,
  leadId: salesLeadId,
  clientLabel,
  amcLeadId,
}: Props) {
  // Whichever record we were opened for — a sales lead or an AMC lead.
  const leadId = salesLeadId ?? amcLeadId ?? null;
  const [rows, setRows] = useState<QuotationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuotationDetailsResponse | null>(null);

  useEffect(() => {
    if (!isOpen || !leadId) return;

    setLoading(true);
    setError(null);
    (salesLeadId ? getQuotationsByLead(salesLeadId) : getQuotationsByAmcLead(leadId))
      .then(setRows)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load quotations")
      )
      .finally(() => setLoading(false));
  }, [isOpen, leadId, salesLeadId]);

  const openPreview = async (id: string) => {
    try {
      setPreview(await getQuotationById(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that quotation");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-5 py-4 flex justify-between items-center">
            <div>
              <div className="text-lg font-bold">Quotations</div>
              {clientLabel && (
                <div className="text-xs opacity-90">{clientLabel}</div>
              )}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-black/20">
              <X size={22} />
            </button>
          </div>

          <div className="p-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-4">
                ⚠️ {error}
              </div>
            )}

            {!leadId && (
              <div className="text-center text-gray-500 py-8 text-sm">
                This record isn't linked to a lead, so there's no quotation to
                trace back to.
              </div>
            )}

            {leadId && loading && (
              <div className="text-center text-gray-500 py-8 text-sm">Loading…</div>
            )}

            {leadId && !loading && rows.length === 0 && !error && (
              <div className="text-center text-gray-500 py-8 text-sm">
                No quotation was raised for this client in the CRM.
              </div>
            )}

            {rows.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-4 border border-gray-200 rounded-lg px-4 py-3 mb-3 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">{q.offerNumber}</div>
                  <div className="text-xs text-gray-500">
                    {q.certificationTypeLabel} · {formatDate(q.offerDate)}
                    {q.expired && (
                      <span className="ml-2 text-amber-700 font-medium">
                        past validity
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right whitespace-nowrap">
                  <div className="font-semibold text-gray-900">
                    {money(q.totalInr)}
                  </div>
                  <span
                    className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[q.status] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {q.status}
                  </span>
                </div>

                <button
                  onClick={() => openPreview(q.id)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 whitespace-nowrap"
                >
                  <FileText size={14} /> Open
                </button>
              </div>
            ))}

            {rows.length > 0 && (
              <p className="text-xs text-gray-500 mt-4 flex items-center gap-1">
                <Download size={13} /> Open a quotation to read it in full or
                download the PDF the client received.
              </p>
            )}
          </div>
        </div>
      </div>

      <QuotationPreviewModal
        quotation={preview}
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        readOnly
      />
    </>
  );
}