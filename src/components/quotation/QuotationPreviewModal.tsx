// src/components/quotation/QuotationPreviewModal.tsx
//
// Shows the rendered quotation and downloads it. The PDF is captured from
// the very element on screen (downloadElementAsPdf -> html2canvas), so
// what the user reviews here is byte-for-byte what the client receives.

import { useEffect, useState } from "react";
import { X, Download, Send, Check, Ban } from "lucide-react";
import QuotationDocument from "./QuotationDocument";
// Block-aware export: the shared invoice util slices the capture at fixed
// A4 intervals with no regard for what sits on the boundary, which cut the
// Payment Terms table clean in half.
import { downloadQuotationPdf } from "../../utils/downloadQuotation";
import {
  getQuotationFile,
  markQuotationSent,
  setQuotationOutcome,
  type QuotationDetailsResponse,
} from "../../services/quotationService";

interface Props {
  quotation: QuotationDetailsResponse | null;
  isOpen: boolean;
  onClose: () => void;
  /** Fired after Mark Sent / Accepted / Rejected so the list can refresh. */
  onUpdated?: (q: QuotationDetailsResponse) => void;

  /**
   * Hides the status controls, leaving preview and download.
   *
   * Used by the finance pages: Accounts opens a quotation to check what was
   * quoted before raising the PI, but recording whether the client accepted
   * it belongs to whoever is having that conversation.
   */
  readOnly?: boolean;
}

const ELEMENT_ID = "quotation-document-print";

export default function QuotationPreviewModal({
  quotation,
  isOpen,
  onClose,
  onUpdated,
  readOnly = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !quotation) return null;

  const run = async (fn: () => Promise<QuotationDetailsResponse>) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await fn();
      onUpdated?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work");
    } finally {
      setBusy(false);
    }
  };

  // Uploaded / received quotation: the file itself is the document.
  const hasFile = Boolean(quotation.fileName);
  const received = quotation.entryType === "RECEIVED";

  const handleDownload = async () => {
    setBusy(true);
    try {
      if (hasFile) {
        const blob = await getQuotationFile(quotation.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = quotation.fileName || `${quotation.offerNumber.replace(/\//g, "-")}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
      await downloadQuotationPdf(
        ELEMENT_ID,
        `${quotation.offerNumber.replace(/\//g, "-")}.pdf`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not build the PDF");
    } finally {
      setBusy(false);
    }
  };

  // A received quotation isn't our offer: no Mark Sent / Accepted / Rejected.
  const isDraft = !readOnly && !received && quotation.status === "DRAFT";
  const awaitingOutcome =
    !readOnly && !received && (quotation.status === "SENT" || quotation.status === "EXPIRED");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white sm:rounded-lg shadow-xl max-w-4xl w-full min-h-full sm:min-h-0 sm:my-6">
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3 sm:p-4 flex flex-wrap justify-between items-center gap-2 sm:rounded-t-lg z-10">
          <div>
            <div className="text-lg font-bold">{quotation.offerNumber}</div>
            <div className="text-xs opacity-90">
              {quotation.certificationTypeLabel} · {received ? "RECEIVED" : quotation.status}
              {quotation.revisionNo ? ` · Revision ${quotation.revisionNo}` : ""}
              {quotation.entryType === "UPLOADED" && " · uploaded file"}
              {quotation.expired && quotation.status !== "EXPIRED" && " · past validity"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <button
                disabled={busy}
                onClick={() => run(() => markQuotationSent(quotation.id))}
                className="flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded text-sm"
              >
                <Send size={15} /> Mark Sent
              </button>
            )}
            {awaitingOutcome && (
              <>
                <button
                  disabled={busy}
                  onClick={() => run(() => setQuotationOutcome(quotation.id, "ACCEPTED"))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm"
                >
                  <Check size={15} /> Accepted
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => setQuotationOutcome(quotation.id, "REJECTED"))}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  <Ban size={15} /> Rejected
                </button>
              </>
            )}
            <button
              disabled={busy}
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded text-sm"
            >
              <Download size={15} /> {busy ? "Working…" : hasFile ? "Download file" : "Download PDF"}
            </button>
            <button onClick={onClose} className="p-1 rounded hover:bg-black/20">
              <X size={22} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-4 py-2 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* On a phone the A4 page is wider than the screen: it starts at the
            left edge and scrolls sideways (centring would cut off its left side). */}
        {hasFile ? (
          <UploadedFileView
            quotationId={quotation.id}
            fileName={quotation.fileName ?? ""}
            contentType={quotation.fileContentType ?? ""}
            remarks={quotation.remarks}
          />
        ) : (
        <div className="p-2 sm:p-4 bg-gray-100 flex justify-start lg:justify-center overflow-x-auto">
          <QuotationDocument
            elementId={ELEMENT_ID}
            certificationType={quotation.certificationType}
            offerNumber={quotation.offerNumber}
            offerDate={quotation.offerDate}
            validUntil={quotation.validUntil}
            clientName={quotation.clientName}
            clientCompany={quotation.clientCompany}
            clientEmail={quotation.clientEmail}
            clientMobile={quotation.clientMobile}
            kindAttention={quotation.kindAttention}
            introNote={quotation.introNote}
            introParagraph={quotation.introParagraph}
            projectDescription={quotation.projectDescription}
            functionalScope={quotation.functionalScope}
            totalTimeline={quotation.totalTimeline}
            basicAspects={quotation.basicAspects}
            basicRequirements={quotation.basicRequirements}
            basicRequirementsNote={quotation.basicRequirementsNote}
            sampleRequirements={quotation.sampleRequirements}
            sampleRemark={quotation.sampleRemark}
            sampleGuidelines={quotation.sampleGuidelines}
            workScope={quotation.workScope}
            terms={quotation.terms}
            paymentRatio={quotation.paymentRatio}
            showCurrencyColumn={quotation.showCurrencyColumn}
            closingNote={quotation.closingNote}
            signatoryName={quotation.signatoryName}
            signatoryTitle={quotation.signatoryTitle}
            lineItems={quotation.lineItems}
            totalInr={quotation.totalInr}
            totalUsd={quotation.totalUsd}
          />
        </div>
        )}
      </div>
    </div>
  );
}

/**
 * Shows an uploaded quotation file inside the CRM. PDF and photos open
 * right here; Word / Excel can't be shown in a browser, so those get a
 * download button instead. The file is fetched with the login token and
 * shown from a temporary local link.
 */
function UploadedFileView({
  quotationId,
  fileName,
  contentType,
  remarks,
}: {
  quotationId: string;
  fileName: string;
  contentType: string;
  remarks?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const lower = fileName.toLowerCase();
  const isPdf = contentType.includes("pdf") || lower.endsWith(".pdf");
  const isImage = contentType.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(lower);
  const canShow = isPdf || isImage;

  useEffect(() => {
    if (!canShow) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    getQuotationFile(quotationId)
      .then((blob) => {
        if (cancelled) return;
        // Typed blob, so the browser's PDF viewer recognises it.
        const typed = blob.type ? blob : new Blob([blob], { type: isPdf ? "application/pdf" : contentType });
        objectUrl = URL.createObjectURL(typed);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setFailed(err instanceof Error ? err.message : "Could not open the file");
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [quotationId, canShow, isPdf, contentType]);

  return (
    <div className="p-3 sm:p-4 bg-gray-100 space-y-3">
      {remarks && (
        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
          <span className="font-medium">Remarks:</span> {remarks}
        </div>
      )}
      {failed && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {failed}</div>
      )}
      {!canShow && (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-600">
          <b className="block text-gray-900 mb-1 break-all">{fileName}</b>
          This file type can't be shown in the browser. Use <b>Download file</b> above to open it.
        </div>
      )}
      {canShow && !url && !failed && (
        <p className="py-10 text-center text-gray-500 text-sm">Opening file…</p>
      )}
      {url && isPdf && (
        <iframe title={fileName} src={url} className="w-full h-[75vh] bg-white rounded-lg border border-gray-200" />
      )}
      {url && isImage && (
        <img src={url} alt={fileName} className="max-w-full mx-auto bg-white rounded-lg border border-gray-200" />
      )}
    </div>
  );
}