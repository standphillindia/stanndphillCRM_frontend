/**
 * GST constants and display helpers.
 *
 * IMPORTANT — read this before changing anything here.
 *
 * The backend is the authority on tax. InvoiceTaxService calculates the
 * real cgst/sgst/igst figures and stores them; whatever the browser
 * sends for taxAmount / totalAmount is ignored on save.
 *
 * So why does this file exist at all?
 *
 * Only for the LIVE PREVIEW inside the invoice form — the user needs to
 * see the tax update as they type line items, before anything has been
 * saved and before the backend has had a chance to reply. These helpers
 * mirror the backend's rules exactly (same halving rule, same rounding)
 * so the preview matches what gets stored.
 *
 * Once an invoice IS saved, always render the values that came back
 * from the API (invoice.cgstAmount etc.) — never recompute them here.
 *
 * If you change the rules below, change InvoiceTaxService.java to match.
 */

export type TaxType = "CGST_SGST" | "IGST";

/** Total GST rate. CGST and SGST are each exactly half of this. */
export const DEFAULT_GST_RATE = 18;

/** Standphill India is registered in Uttar Pradesh. */
export const COMPANY_STATE = "Uttar Pradesh";

/** First two digits of a UP GSTIN. */
export const COMPANY_GST_STATE_CODE = "09";

/**
 * Rounds to 2 decimal places, half away from zero — matches Java's
 * BigDecimal HALF_UP. The epsilon guards against float artefacts like
 * 1.005 being held as 1.00499999999999989.
 */
export const round2 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Mirrors InvoiceTaxService.isIntraState().
 *
 * The state name is checked first, then the GSTIN prefix as a fallback —
 * the typed place of supply is free text and is often left blank, while
 * the GSTIN is structured and reliable.
 */
export const detectTaxType = (
  placeOfSupply?: string | null,
  clientGst?: string | null
): TaxType => {
  const state = placeOfSupply?.trim().toLowerCase();

  if (state && state === COMPANY_STATE.toLowerCase()) {
    return "CGST_SGST";
  }

  const gst = clientGst?.trim();

  if (gst && gst.length >= 2) {
    return gst.slice(0, 2) === COMPANY_GST_STATE_CODE
      ? "CGST_SGST"
      : "IGST";
  }

  // No GSTIN to go on — unregistered/B2C buyer. Matches the backend's
  // default of treating the supply as inter-state.
  return "IGST";
};

export interface TaxBreakdown {
  taxType: TaxType;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Mirrors InvoiceTaxService.calculate().
 *
 * Note that SGST is derived by subtraction, not by halving a second
 * time. On an odd total tax of 0.01 that gives 0.01 + 0.00 rather than
 * 0.01 + 0.01, so the two halves always add up to the total exactly.
 */
export const calculateTaxBreakdown = (
  taxableAmount: number,
  taxType: TaxType,
  gstRate: number = DEFAULT_GST_RATE
): TaxBreakdown => {
  const taxable = round2(taxableAmount || 0);
  const rate = gstRate ?? DEFAULT_GST_RATE;

  const taxAmount = round2((taxable * rate) / 100);
  const halfRate = round2(rate / 2);

  if (taxType === "CGST_SGST") {
    const cgstAmount = round2(taxAmount / 2);

    return {
      taxType,
      gstRate: rate,
      cgstRate: halfRate,
      cgstAmount,
      sgstRate: halfRate,
      sgstAmount: round2(taxAmount - cgstAmount),
      igstRate: 0,
      igstAmount: 0,
      taxableAmount: taxable,
      taxAmount,
      totalAmount: round2(taxable + taxAmount),
    };
  }

  return {
    taxType: "IGST",
    gstRate: rate,
    cgstRate: 0,
    cgstAmount: 0,
    sgstRate: 0,
    sgstAmount: 0,
    igstRate: rate,
    igstAmount: taxAmount,
    taxableAmount: taxable,
    taxAmount,
    totalAmount: round2(taxable + taxAmount),
  };
};

/** "18.00" -> "18", "2.50" -> "2.5" — for rate labels on screen. */
export const formatRate = (rate?: number | null): string => {
  if (rate === null || rate === undefined) return "0";
  return String(parseFloat(rate.toFixed(2)));
};