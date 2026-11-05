// src/components/quotation/LinkLeadModal.tsx
//
// Quotations page → attach an existing quotation to a lead.
//
// Many quotations were raised straight from the Quotations page with no
// lead, so Accounts never saw them when raising the PI. This fixes those
// after the fact, at any status (Accepted included) — only the link
// changes, never the document.

import { useState } from "react";
import { X } from "lucide-react";
import LeadPicker from "./LeadPicker";
import type { LeadResponse } from "../../services/leadService";
import {
  linkQuotationToLead,
  type QuotationResponse,
} from "../../services/quotationService";

interface Props {
  quotation: QuotationResponse | null;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkLeadModal({ quotation, onClose, onLinked }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quotation) return null;

  const save = async (lead: LeadResponse | null) => {
    setSaving(true);
    setError(null);
    try {
      await linkQuotationToLead(quotation.id, lead?.id ?? null);
      onLinked();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message ?? e?.message ?? "Could not link the lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Link to lead</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {quotation.offerNumber} · {quotation.clientCompany || quotation.kindAttention || "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 min-h-[320px]">
          <p className="text-sm text-gray-600">
            Pick the lead this quotation belongs to. Accounts will then see the quoted
            amount on the Payments page when they raise the PI.
          </p>

          <LeadPicker value={undefined} onChange={(l) => l && save(l)} />

          {quotation.leadId && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Remove current lead link
            </button>
          )}

          {saving && <p className="text-xs text-gray-500">Saving…</p>}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}