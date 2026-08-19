/**
 * Complete Invoice Utilities
 * Combines PDF generation + formatting helpers
 * Location: src/utils/invoiceUtils.ts
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ════════════════════════════════════════════════════════════════
// PDF DOWNLOAD FUNCTIONS (Your Existing Code)
// ════════════════════════════════════════════════════════════════

export async function downloadElementAsPdf(
  elementId: string,
  fileName: string = "invoice.pdf"
): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    throw new Error(`Element with id "${elementId}" not found.`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: -window.scrollY,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let remainingHeight = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
  remainingHeight -= pdfHeight;

  while (remainingHeight > 0) {
    position = remainingHeight - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    remainingHeight -= pdfHeight;
  }

  pdf.save(fileName);
}

/**
 * Download Proforma Invoice as PDF
 * Usage: await downloadProformaInvoice("PI-2026-0029.pdf")
 */
export async function downloadProformaInvoice(
  fileName: string = "proforma-invoice.pdf"
): Promise<void> {
  return downloadElementAsPdf("standphill-pi", fileName);
}

/**
 * Download Tax Invoice as PDF
 * Usage: await downloadTaxInvoice("TI-2026-0029.pdf")
 */
export async function downloadTaxInvoice(
  fileName: string = "tax-invoice.pdf"
): Promise<void> {
  return downloadElementAsPdf("standphill-ti", fileName);
}

// ════════════════════════════════════════════════════════════════
// FORMATTING HELPERS (New - Add to Your Existing Utils)
// ════════════════════════════════════════════════════════════════

/**
 * Format number as Indian currency (₹)
 * Handles: numbers, strings, undefined
 * Returns: formatted string with no decimal places
 * 
 * Examples:
 *   formatMoney(700000) → "₹7,00,000"
 *   formatMoney("700000") → "₹7,00,000"
 */
export function formatMoney(value: number | string | undefined): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "INR",
  }).format(Math.round(amount));
}

/**
 * Format currency without symbol (just number with commas)
 * 
 * Examples:
 *   formatCurrency(700000) → "7,00,000"
 *   formatCurrency("700000") → "7,00,000"
 */
export function formatCurrency(value: number | string | undefined): string {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

/**
 * Format date to: "JUN 27, 2026" (uppercase)
 * Accepts: ISO string, DD/MM/YYYY format, Date object
 * 
 * Examples:
 *   formatDate("2026-06-27") → "JUN 27, 2026"
 *   formatDate("27/06/2026") → "JUN 27, 2026"
 */
export function formatDate(value: string | Date): string {
  if (!value) {
    return new Date().toISOString().split("T")[0].toUpperCase();
  }

  let date: Date | null = null;

  // Handle DD/MM/YYYY format
  if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/");
    date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value).toUpperCase();
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  })
    .format(date)
    .toUpperCase();
}

/**
 * Format date to ISO format: "2026-06-27"
 */
export function formatDateISO(value: string | Date): string {
  if (!value) return new Date().toISOString().split("T")[0];

  let date: Date | null = null;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string") {
    date = new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().split("T")[0];
}

// Tax helpers used to live here as a third, divergent copy — this one
// rounded with Math.round while invoiceService used toFixed(2), so the
// same invoice could total differently depending on which module you
// went through. Tax now belongs to the backend, with a single mirrored
// preview implementation in constants/taxConstants.ts.

/**
 * Format line items for invoice display
 * Ensures description doesn't exceed visible width
 */
export function formatDescription(description: string, maxLength: number = 80): string {
  if (!description) return "";
  if (description.length <= maxLength) return description;
  return description.substring(0, maxLength) + "...";
}

/**
 * Validate GST number format (Indian)
 * Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter
 * Example: 07AHNPJ2190E1ZE
 * 
 * Usage:
 *   if (validateGST("07AHNPJ2190E1ZE")) { ... }
 */
export function validateGST(gst: string): boolean {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[Z]{1}[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase());
}

/**
 * Format GST number to uppercase
 */
export function formatGST(gst: string): string {
  return gst ? gst.toUpperCase() : "";
}

/**
 * Validate PAN format (Indian)
 * Format: 5 letters + 4 digits + 1 letter
 * Example: AEZFS7173R
 */
export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

/**
 * Format PAN number to uppercase
 */
export function formatPAN(pan: string): string {
  return pan ? pan.toUpperCase() : "";
}

/**
 * Calculate number of pages needed for line items
 * Returns: boolean indicating if additional page might be needed
 */
export function needsMultiplePages(lineItemCount: number): boolean {
  // Approximate: ~20 items per A4 page with header/footer
  return lineItemCount > 20;
}

/**
 * Group line items for pagination
 * Useful if invoice spans multiple pages
 * 
 * Usage:
 *   const pages = groupLineItems(items, 20);
 */
export function groupLineItems(
  items: any[],
  itemsPerPage: number = 20
): any[][] {
  const groups: any[][] = [];
  for (let i = 0; i < items.length; i += itemsPerPage) {
    groups.push(items.slice(i, i + itemsPerPage));
  }
  return groups;
}

/**
 * Format amount with rupee symbol
 * Example: "₹ 7,00,000"
 */
export function formatAmountWithSymbol(value: number | string | undefined): string {
  const formatted = formatCurrency(value);
  return `₹ ${formatted}`;
}

/**
 * Extract year from date string
 */
export function getYear(dateStr: string): string {
  if (!dateStr) return new Date().getFullYear().toString();
  const date = new Date(dateStr);
  return date.getFullYear().toString();
}

/**
 * Extract month from date string
 */
export function getMonth(dateStr: string): string {
  if (!dateStr) return String(new Date().getMonth() + 1).padStart(2, "0");
  const date = new Date(dateStr);
  return String(date.getMonth() + 1).padStart(2, "0");
}

/**
 * Generate invoice number based on pattern
 * Pattern: PI-YYYY-####
 * Example: PI-2026-0029
 * 
 * Usage:
 *   generateInvoiceNumber(2026, 29) → "PI-2026-0029"
 */
export function generateInvoiceNumber(
  year: string | number,
  sequenceNo: string | number
): string {
  const yearStr = String(year);
  const seqStr = String(sequenceNo).padStart(4, "0");
  return `PI-${yearStr}-${seqStr}`;
}

// ════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ════════════════════════════════════════════════════════════════

export interface InvoiceLineItem {
  id: string;
  description: string;
  hsnSac: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
}

export interface InvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  customerName: string;
  customerAddress: string;
  customerGst: string;
  sellerName: string;
  sellerAddress: string;
  sellerGst: string;
  sellerPan: string;
  lineItems: InvoiceLineItem[];
  bankName?: string;
  accountHolder?: string;
  accountNo?: string;
  ifscCode?: string;
  reference?: string;
}

/**
 * Validate invoice data completeness
 * 
 * Usage:
 *   const { valid, errors } = validateInvoiceData(data);
 *   if (!valid) {
 *     console.error("Validation errors:", errors);
 *   }
 */
export function validateInvoiceData(data: Partial<InvoiceData>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.invoiceNo) errors.push("Invoice number is required");
  if (!data.invoiceDate) errors.push("Invoice date is required");
  if (!data.customerName) errors.push("Customer name is required");
  if (!data.customerAddress) errors.push("Customer address is required");
  if (!data.customerGst) errors.push("Customer GST is required");
  if (data.customerGst && !validateGST(data.customerGst)) {
    errors.push("Invalid customer GST format");
  }
  if (!data.sellerName) errors.push("Seller name is required");
  if (!data.sellerAddress) errors.push("Seller address is required");
  if (!data.sellerGst) errors.push("Seller GST is required");
  if (data.sellerGst && !validateGST(data.sellerGst)) {
    errors.push("Invalid seller GST format");
  }
  if (!data.sellerPan) errors.push("Seller PAN is required");
  if (data.sellerPan && !validatePAN(data.sellerPan)) {
    errors.push("Invalid seller PAN format");
  }
  if (!data.lineItems || data.lineItems.length === 0) {
    errors.push("At least one line item is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ════════════════════════════════════════════════════════════════
// DEFAULT EXPORT
// ════════════════════════════════════════════════════════════════

export default {
  // PDF Functions
  downloadElementAsPdf,
  downloadProformaInvoice,
  downloadTaxInvoice,

  // Formatting Functions
  formatMoney,
  formatCurrency,
  formatDate,
  formatDateISO,
  formatDescription,
  validateGST,
  formatGST,
  validatePAN,
  formatPAN,
  needsMultiplePages,
  groupLineItems,
  formatAmountWithSymbol,
  getYear,
  getMonth,
  generateInvoiceNumber,
  validateInvoiceData,
};