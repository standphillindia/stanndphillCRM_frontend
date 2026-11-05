// src/components/quotation/UploadQuotationModal.tsx
//
// Upload a quotation file and keep it as a normal quotation record:
//   - "New quotation" — made by hand (Word / Canva) for a service that
//     comes up rarely, uploaded here for the record;
//   - "Revised quotation" — a changed version of a quotation already in
//     the CRM (new rate / scope after talking to the client). Pick the
//     original; this one joins its series (…/R1, …/R2) with the same
//     client and lead, and the original stays as it was sent.
// Also used for editing an uploaded record (existing set), where choosing
// a new file replaces the old one.

import { useEffect, useMemo, useState } from "react";
import { X, Upload, FileText } from "lucide-react";
import {
  getCertificationTypes,
  uploadQuotation,
  updateUploadedQuotation,
  type CertificationTypeOption,
  type QuotationDetailsResponse,
  type QuotationEntryType,
  type QuotationResponse,
  type UploadQuotationFields,
} from "../../services/quotationService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (saved: QuotationDetailsResponse) => void;
  /** Editing an uploaded / received quotation. */
  existing?: QuotationDetailsResponse | null;
  /** Uploading a revised version of this quotation. */
  revisionOf?: QuotationResponse | QuotationDetailsResponse | null;
  /** Kind to start with (e.g. the Received tab starts as RECEIVED). */
  defaultEntryType?: QuotationEntryType;
  /** Opened for a lead / AMC lead — the record is linked to it. */
  leadId?: string;
  amcLeadId?: string;
  /** Opened from the AMC tab. */
  defaultCertificationType?: string;
  /** Every quotation, to pick the original for a revised one. */
  quotations?: QuotationResponse[];
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const MAX_BYTES = 10 * 1024 * 1024;

const todayIso = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const plusDays = (iso: string, days: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const sizeText = (bytes?: number | null) =>
  bytes == null ? "" : bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function UploadQuotationModal({
  isOpen,
  onClose,
  onSaved,
  existing,
  revisionOf,
  defaultEntryType = "UPLOADED",
  leadId,
  amcLeadId,
  defaultCertificationType,
  quotations = [],
}: Props) {
  const [types, setTypes] = useState<CertificationTypeOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New or revised. Opened from a row's Revise icon = revised, original fixed.
  const [mode, setMode] = useState<"NEW" | "REVISED">(revisionOf ? "REVISED" : "NEW");
  const [pickedOriginal, setPickedOriginal] = useState<QuotationResponse | null>(null);
  const [originalSearch, setOriginalSearch] = useState("");
  const original = revisionOf ?? pickedOriginal;

  // Filled once, when the form opens (the page mounts it only while open):
  // the record being edited, the quotation being revised, or a blank one.
  const [form, setForm] = useState(() => {
    const today = todayIso();
    if (existing) {
      return {
        entryType: ((existing.entryType as QuotationEntryType) || "UPLOADED") as QuotationEntryType,
        certificationType: existing.certificationType ?? "",
        offerNumber: existing.offerNumber ?? "",
        offerDate: existing.offerDate ?? today,
        validUntil: existing.validUntil ?? plusDays(today, 30),
        clientCompany: existing.clientCompany ?? "",
        clientName: existing.kindAttention ?? existing.clientName ?? "",
        clientEmail: existing.clientEmail ?? "",
        clientMobile: existing.clientMobile ?? "",
        amount: existing.totalInr ? String(existing.totalInr) : "",
        status: (existing.status === "EXPIRED" ? "SENT" : existing.status) as NonNullable<UploadQuotationFields["status"]>,
        remarks: existing.remarks ?? "",
      };
    }
    const src = revisionOf as (QuotationResponse & Partial<QuotationDetailsResponse>) | null | undefined;
    return {
      entryType: (src ? (src.entryType as QuotationEntryType) || "UPLOADED" : defaultEntryType) as QuotationEntryType,
      certificationType: src?.certificationType ?? defaultCertificationType ?? "",
      offerNumber: "",
      offerDate: today,
      validUntil: plusDays(today, 30),
      clientCompany: src?.clientCompany ?? "",
      clientName: src?.kindAttention ?? src?.clientName ?? "",
      clientEmail: src?.clientEmail ?? "",
      clientMobile: src?.clientMobile ?? "",
      amount: "",
      status: "SENT" as NonNullable<UploadQuotationFields["status"]>,
      remarks: "",
    };
  });

  useEffect(() => {
    getCertificationTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  // Only an older "received" record (edited here) still uses that kind.
  const received = form.entryType === "RECEIVED";
  const title = useMemo(() => {
    if (existing) return `Edit ${existing.offerNumber}`;
    if (revisionOf) return `Upload revised quotation — ${revisionOf.offerNumber}`;
    return "Upload quotation";
  }, [existing, revisionOf]);

  // Originals to choose from: our own quotations, matching the search.
  const originalChoices = useMemo(() => {
    const q = originalSearch.trim().toLowerCase();
    return quotations
      .filter((r) => r.entryType !== "RECEIVED")
      .filter(
        (r) =>
          !q ||
          r.offerNumber.toLowerCase().includes(q) ||
          (r.clientCompany ?? "").toLowerCase().includes(q) ||
          (r.kindAttention ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [quotations, originalSearch]);

  if (!isOpen) return null;

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  /** Original chosen: start from its type and client details. */
  const pickOriginal = (r: QuotationResponse) => {
    setPickedOriginal(r);
    setOriginalSearch("");
    setForm((f) => ({
      ...f,
      certificationType: r.certificationType ?? f.certificationType,
      clientCompany: r.clientCompany ?? "",
      clientName: r.kindAttention ?? "",
    }));
  };

  const pickFile = (f: File | null) => {
    setError(null);
    if (f && f.size > MAX_BYTES) {
      setError("This file is too large — the limit is 10 MB. Compress the PDF and try again.");
      setFile(null);
      return;
    }
    setFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!existing && !file) {
      setError("Please choose the quotation file.");
      return;
    }
    if (!existing && mode === "REVISED" && !original) {
      setError("Choose the original quotation this one revises.");
      return;
    }
    if (!received && !form.certificationType) {
      setError("Please choose the quotation type (service).");
      return;
    }
    const amount = form.amount.trim() === "" ? null : Number(form.amount);
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      setError("Amount must be a number (0 or more).");
      return;
    }

    const fields: UploadQuotationFields = {
      entryType: form.entryType,
      certificationType: form.certificationType || undefined,
      offerNumber: form.offerNumber.trim() || undefined,
      offerDate: form.offerDate || undefined,
      validUntil: form.validUntil || undefined,
      clientCompany: form.clientCompany,
      clientName: form.clientName,
      clientEmail: form.clientEmail,
      clientMobile: form.clientMobile,
      amount,
      status: received ? undefined : form.status,
      remarks: form.remarks,
      leadId: existing ? undefined : leadId,
      amcLeadId: existing ? undefined : amcLeadId,
      revisionOfId: !existing && mode === "REVISED" ? original?.id : undefined,
    };

    setSaving(true);
    try {
      const saved = existing
        ? await updateUploadedQuotation(existing.id, fields, file)
        : await uploadQuotation(fields, file as File);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the quotation");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const label = "block text-xs font-medium text-gray-600 mb-1";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <form
        onSubmit={submit}
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-xl shadow-xl max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 break-all pr-2">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-4 space-y-4 overflow-y-auto">
          {/* New, or a revised version of one already in the CRM. Not shown
              when editing (an older "received" record keeps its kind). */}
          {!existing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                ["NEW", "New quotation", "Made outside the CRM (Word / Canva) — kept here for the record"],
                ["REVISED", "Revised quotation", "Changed version of a quotation already in the CRM (new rate / scope)"],
              ] as const).map(([value, name, hint]) => (
                <label
                  key={value}
                  className={`flex gap-2 p-3 rounded-lg border ${
                    revisionOf && value === "NEW" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  } ${mode === value ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}
                >
                  <input
                    type="radio"
                    name="uploadMode"
                    className="mt-1"
                    checked={mode === value}
                    disabled={Boolean(revisionOf) && value === "NEW"}
                    onChange={() => setMode(value)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-gray-900">{name}</span>
                    <span className="block text-xs text-gray-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {/* Revised: which quotation it revises. */}
          {!existing && mode === "REVISED" && !original && (
            <div>
              <span className={label}>Original quotation *</span>
              <input
                className={input}
                value={originalSearch}
                onChange={(e) => setOriginalSearch(e.target.value)}
                placeholder="Search by offer number or company…"
                autoFocus
              />
              <div className="mt-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {originalChoices.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-500">No quotation matches.</p>
                )}
                {originalChoices.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => pickOriginal(r)}
                    className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                  >
                    <span className="block text-sm font-medium text-gray-900 break-all">{r.offerNumber}</span>
                    <span className="block text-xs text-gray-500">
                      {r.clientCompany || "—"} · {r.certificationTypeLabel}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!existing && mode === "REVISED" && original && (
            <div className="flex items-start justify-between gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
              <span>
                Revised version of <b className="break-all">{original.offerNumber}</b>
                {original.clientCompany ? ` (${original.clientCompany})` : ""} — numbered …/R1, …/R2, same client and
                lead. The original stays as it was sent.
              </span>
              {!revisionOf && (
                <button type="button" onClick={() => setPickedOriginal(null)} className="shrink-0 font-semibold underline">
                  Change
                </button>
              )}
            </div>
          )}

          {/* File */}
          <div>
            <span className={label}>
              Quotation file {existing ? "(choose a new file only to replace it)" : "*"}
            </span>
            <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400">
              <Upload size={20} className="text-indigo-600 shrink-0" />
              <span className="text-sm text-gray-700 break-all">
                {file
                  ? `${file.name} (${sizeText(file.size)})`
                  : existing?.fileName
                  ? `Current: ${existing.fileName} (${sizeText(existing.fileSize)})`
                  : "Choose PDF, Word, Excel or photo — max 10 MB"}
              </span>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={label}>Type / service {received ? "(optional)" : "*"}</span>
              <select
                className={input}
                value={form.certificationType}
                onChange={(e) => set("certificationType", e.target.value)}
              >
                <option value="">Select…</option>
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={label}>{received ? "Their quotation / reference no." : "Offer number"}</span>
              <input
                className={input}
                value={form.offerNumber}
                onChange={(e) => set("offerNumber", e.target.value)}
                placeholder={mode === "REVISED" && !existing ? "Leave blank for …/R1" : received ? "Leave blank for RCV/…" : "Leave blank for the next number"}
              />
            </div>
            <div>
              <span className={label}>Quotation date</span>
              <input type="date" className={input} value={form.offerDate} onChange={(e) => set("offerDate", e.target.value)} />
            </div>
            <div>
              <span className={label}>Valid until</span>
              <input type="date" className={input} value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
            </div>
            <div>
              <span className={label}>{received ? "Received from (company)" : "Client company"}</span>
              <input className={input} value={form.clientCompany} onChange={(e) => set("clientCompany", e.target.value)} />
            </div>
            <div>
              <span className={label}>Contact person</span>
              <input className={input} value={form.clientName} onChange={(e) => set("clientName", e.target.value)} />
            </div>
            <div>
              <span className={label}>Email</span>
              <input type="email" className={input} value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} />
            </div>
            <div>
              <span className={label}>Mobile</span>
              <input inputMode="tel" className={input} value={form.clientMobile} onChange={(e) => set("clientMobile", e.target.value)} />
            </div>
            <div>
              <span className={label}>Amount (₹)</span>
              <input
                inputMode="decimal"
                className={input}
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="Total amount on the quotation"
              />
            </div>
            {!received && (
              <div>
                <span className={label}>Status</span>
                <select
                  className={input}
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  <option value="DRAFT">Draft (not sent yet)</option>
                  <option value="SENT">Sent to client</option>
                  <option value="ACCEPTED">Accepted</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <span className={label}>Remarks</span>
            <textarea
              rows={2}
              className={input}
              value={form.remarks}
              onChange={(e) => set("remarks", e.target.value)}
              placeholder={received ? "e.g. Lab rate for sample testing" : "Anything worth noting"}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {error}</div>
          )}
        </div>

        <div className="flex gap-3 justify-end px-4 sm:px-6 py-3 border-t bg-gray-50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            <FileText size={16} /> {saving ? "Saving…" : existing ? "Save changes" : "Save quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}