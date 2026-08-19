/**
 * Dynamic UPI QR generation for invoices (PI / TI).
 *
 * Builds a NPCI-standard UPI deep link with the invoice's total amount and
 * invoice number pre-filled, then renders it as a QR data-URL via the
 * `qrcode` package. The result is a plain base64 <img> source, which keeps
 * html2canvas / jsPDF export fully compatible (same as the old static QR).
 *
 * Static fallback: if generation ever fails (should not happen in practice),
 * callers fall back to UPI_QR_DATA_URI from src/assets/upiQr.ts.
 */

import QRCode from "qrcode";

// ── Standphill UPI identity (PhonePe / HDFC Bank - 3304) ────────────────
export const UPI_PAYEE_VPA = "9667674225@ibl";
export const UPI_PAYEE_NAME = "STANDPHILL INDIA";

export interface UpiQrOptions {
  /** Invoice total in INR, e.g. tax.totalAmount (41300). */
  amount?: number;
  /**
   * Transaction note shown in the payer's UPI app and bank narration.
   * Use the PI/TI number, e.g. "PI-2026-0024" — makes reconciliation easy.
   */
  note?: string;
}

/**
 * Build the NPCI UPI deep link string.
 *
 * Example output:
 *   upi://pay?pa=9667674225@ibl&pn=STANDPHILL%20INDIA&am=41300.00&tn=PI-2026-0024&cu=INR
 */
export function buildUpiPaymentString(options: UpiQrOptions = {}): string {
  // NOTE: deliberately NOT using URLSearchParams — it encodes spaces as "+",
  // which some UPI apps display literally ("STANDPHILL+INDIA"). NPCI expects
  // standard percent-encoding (%20), which encodeURIComponent produces.
  const params: string[] = [
    `pa=${encodeURIComponent(UPI_PAYEE_VPA)}`,
    `pn=${encodeURIComponent(UPI_PAYEE_NAME)}`,
  ];

  // Amount: only include when it is a positive finite number. UPI spec
  // expects a plain decimal with up to 2 fraction digits.
  if (
    typeof options.amount === "number" &&
    Number.isFinite(options.amount) &&
    options.amount > 0
  ) {
    params.push(`am=${options.amount.toFixed(2)}`);
    params.push(`cu=INR`);
  }

  // Transaction note: strip characters some UPI apps reject and clamp
  // length defensively (NPCI allows ~50 chars for tn).
  if (options.note) {
    const safeNote = options.note.replace(/[^A-Za-z0-9 /._-]/g, "").slice(0, 50);
    if (safeNote) {
      params.push(`tn=${encodeURIComponent(safeNote)}`);
    }
  }

  return `upi://pay?${params.join("&")}`;
}

/**
 * Generate the QR as a PNG data-URL, ready for an <img src>.
 *
 * - errorCorrectionLevel "M": good balance of density vs scan reliability
 *   at the small print size used on the invoice.
 * - margin 1: thin quiet-zone; the invoice cell already provides padding.
 * - width 300: crisp at html2canvas scale:2 without bloating the PDF.
 */
export async function generateUpiQrDataUrl(
  options: UpiQrOptions = {}
): Promise<string> {
  const upiString = buildUpiPaymentString(options);

  return QRCode.toDataURL(upiString, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}