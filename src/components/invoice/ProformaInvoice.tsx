import React from "react";
import "./InvoiceStyles.css";
import UpiQr from "./UpiQr";
import logo from "../../assets/invoicelogo.png";
import { getSignatoryByName } from "../../config/signatories";
import { formatRate, type TaxType } from "../../constants/taxConstants";
import { amountInWords } from "../../utils/amountInWords";

export interface CustomerDetails {
  companyName: string;
  address: string;
  gstNo?: string;
  reference?: string;
  // Client's state for GST (Place of Supply). Printed as
  // "State Name / State Code" — required on a Tax Invoice.
  stateName?: string | null;
  stateCode?: string | null;
}

export interface SellerDetails {
  companyName: string;
  address: string;
  gstNo: string;
  panNo: string;
  stateName?: string;
  stateCode?: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsnSac: string;
  amount: number;
  // Optional: when any line has a quantity above 1 (e.g. 6 samples), the
  // table prints Qty and Rate columns so the client sees how the amount
  // is made up (6 × 35,600). Single-quantity invoices look as before.
  quantity?: number | null;
  unitPrice?: number | null;
}

export interface BankDetails {
  beneficiaryName: string;
  bankName: string;
  accountNo: string;
  ifscCode: string;
}

export interface TaxDetails {
  nonTaxableAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number;

  // What the non-taxable amount is for — printed as
  // "Nontaxable Amount (<label>)". Blank = "Government Fee".
  nonTaxableLabel?: string | null;

  // Which tax heads to print. Only one side is ever shown:
  //   CGST_SGST -> the CGST and SGST rows (intra-state supply)
  //   IGST      -> a single IGST row (inter-state supply)
  //
  // Printing all three heads with zeros against the unused ones is not
  // a valid GST invoice, which is what this used to do.
  //
  // Optional so existing callers keep compiling; when omitted the type
  // is inferred from whichever amount is non-zero, defaulting to IGST.
  taxType?: TaxType;

  // Rates actually applied, e.g. 9 and 9, or 18. Optional — falls back
  // to the statutory 9/9/18 split when not supplied.
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

export interface ProformaInvoiceProps {
  invoiceNo: string;
  invoiceDate: string;

  // Defaults to "PROFORMA" for backward compatibility with existing
  // callers. Drives the title, "PI No" vs "TI No" label, and footer text
  // — previously these were hardcoded to Proforma wording even when
  // rendering a Tax Invoice.
  invoiceType?: "PROFORMA" | "TAX";

  customer: CustomerDetails;
  seller: SellerDetails;

  items: InvoiceItem[];

  bank: BankDetails;
  tax: TaxDetails;

  // Name of the chosen authorised signatory (see src/config/signatories.ts).
  // Omit/undefined = no signature block shown, matching old behaviour.
  signatoryName?: string;

  // Tax Invoice only. The PI this TI was made from — printed under the
  // TI No. as "Proforma Invoice No. / Date".
  sourcePiNumber?: string | null;
  sourcePiDate?: string | null;

  // Tax Invoice only. TDS the client deducts (NIL / 2 / 10 %), worked out
  // on the taxable value; adds "Less: TDS" and "Amount after TDS" rows.
  // Never printed on a PI.
  tdsRate?: number | null;
  tdsAmount?: number | null;

  // Proforma only. Money already received against this PI (each payment
  // as recorded in Payments). When there is any, the PI prints "Less:
  // Amount Received till date" and "Balance Due" under the total, and a
  // "Payment Reminder" tag under the title while something is still due —
  // so the same PI can be sent again as the reminder for the balance.
  // Omitted / empty = the PI looks exactly as before.
  payments?: { amount: number; paidDate: string; paymentMode?: string | null }[] | null;
  /** Total received; defaults to the sum of payments. */
  receivedAmount?: number | null;
}

/**
 * Prints text with each numbered point on its own line.
 *
 * Used for Ref: and for item descriptions, where people list products as
 * "…for the following: 1. Chairs 2. Tables" or "1.) HEY 2.) HELLO".
 *
 * Two things make a new line: a line break actually typed in the box, and
 * a number that starts a point — 1. / 1) / 1.) followed by text. A number
 * inside a standard ("IS 5405: 2025", "2018 for") has no such marker, so
 * it stays where it is. whiteSpace: pre-line is kept as a safety net: even
 * if nothing matches, typed line breaks still print as line breaks instead
 * of being collapsed into one run of text by HTML.
 */
const NUMBER_START = /^(\d{1,2}(?:\.\)|\)|\.))\s*(.*)$/;

function RefText({ text }: { text: string }) {
  const intro: string[] = [];
  const points: { number: string; body: string }[] = [];

  (text ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      line
        .split(/\s+(?=\d{1,2}(?:\.\)|\)|\.)\s*\S)/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((part) => {
          const m = part.match(NUMBER_START);
          if (m) points.push({ number: m[1], body: m[2] });
          else if (points.length) points.push({ number: "", body: part });
          else intro.push(part);
        });
    });

  return (
    <span style={{ whiteSpace: "pre-line" }}>
      {intro.map((l, i) => (
        <span key={`i${i}`}>{l}</span>
      ))}
      {points.map((p, i) => (
        <span key={`p${i}`} style={{ display: "block" }}>
          {p.number ? <span style={{ marginRight: 5 }}>{p.number}</span> : null}
          {p.body}
        </span>
      ))}
    </span>
  );
}

/** "2026-10-19" → "19-10-2026"; anything else is printed as given. */
const displayDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
};

const money = (n: number) =>
  (n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ProformaInvoice: React.FC<ProformaInvoiceProps> = ({
  invoiceNo,
  invoiceDate,
  invoiceType = "PROFORMA",
  customer,
  seller,
  items,
  bank,
  tax,
  signatoryName,
  sourcePiNumber,
  sourcePiDate,
  tdsRate,
  tdsAmount,
  payments,
  receivedAmount,
}) => {
  const isTax = invoiceType === "TAX";
  const tdsValue = isTax && (tdsRate ?? 0) > 0
    ? (tdsAmount ?? Math.round(tax.taxableAmount * (tdsRate ?? 0)) / 100)
    : 0;
  const showTds = isTax && (tdsRate ?? 0) > 0;

  // Qty / Rate columns: printed on every PI / TI (e.g. "1 × 5,000",
  // "6 × 35,600") so the client always sees how each amount is made up.
  // (Earlier they showed only when a line had more than one unit.)
  // The summary rows below span the extra columns.
  const lineQty = (it: InvoiceItem) => Number(it.quantity ?? 1) || 1;
  const lineRate = (it: InvoiceItem) =>
    it.unitPrice != null && Number(it.unitPrice) > 0
      ? Number(it.unitPrice)
      : Math.round((Number(it.amount || 0) / lineQty(it)) * 100) / 100;
  const showQtyRate = items.length > 0;
  const labelSpan = showQtyRate ? 4 : 2;
  const fullSpan = labelSpan + 1;

  // Received / balance (PI only). The received total comes from the
  // Payments record; the lines list each payment.
  const paymentLines = !isTax ? (payments ?? []).filter((p) => Number(p.amount) > 0) : [];
  const received = !isTax
    ? Number(receivedAmount ?? paymentLines.reduce((sum, p) => sum + Number(p.amount || 0), 0))
    : 0;
  const showReceived = !isTax && received > 0;
  const balanceDue = Math.max(0, Math.round((tax.totalAmount - received) * 100) / 100);
  const rupees = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const shortDate = (iso: string) => {
    const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
  };

  // Which tax heads this invoice prints.
  //
  // `tax.taxType` is what the backend decided and is authoritative when
  // present. Older callers don't pass it, so fall back to inferring from
  // the amounts: any CGST/SGST value means an intra-state supply. An
  // all-zero invoice (or a legacy IGST one) lands on IGST, which is how
  // these were printed before the split existed.
  const resolvedTaxType: TaxType =
    tax.taxType ?? (tax.cgst > 0 || tax.sgst > 0 ? "CGST_SGST" : "IGST");
  const documentLabel = isTax ? "Tax Invoice" : "Proforma Invoice";
  const numberLabel = isTax ? "TI No:" : "PI No:";
  const signatory = getSignatoryByName(signatoryName);

  // HSN/SAC-wise tax summary (as on a GST tax invoice). Tax is shared out
  // by each code's taxable value; the last code takes any rounding paisa
  // so the summary always adds up to the invoice's own tax figures.
  const taxTotal = resolvedTaxType === "CGST_SGST" ? tax.cgst + tax.sgst : tax.igst;
  const hsnRows = (() => {
    const byCode = new Map<string, number>();
    items.forEach((it) => {
      const code = (it.hsnSac || "—").trim();
      byCode.set(code, (byCode.get(code) ?? 0) + (Number(it.amount) || 0));
    });
    const totalTaxable = Array.from(byCode.values()).reduce((a, b) => a + b, 0);
    const rows = Array.from(byCode.entries()).map(([code, taxable]) => ({
      code,
      taxable,
      cgst: 0,
      sgst: 0,
      igst: 0,
    }));
    let cg = 0, sg = 0, ig = 0;
    rows.forEach((r, i) => {
      const last = i === rows.length - 1;
      const share = totalTaxable > 0 ? r.taxable / totalTaxable : 0;
      r.cgst = last ? Math.round((tax.cgst - cg) * 100) / 100 : Math.round(tax.cgst * share * 100) / 100;
      r.sgst = last ? Math.round((tax.sgst - sg) * 100) / 100 : Math.round(tax.sgst * share * 100) / 100;
      r.igst = last ? Math.round((tax.igst - ig) * 100) / 100 : Math.round(tax.igst * share * 100) / 100;
      cg += r.cgst; sg += r.sgst; ig += r.igst;
    });
    return rows;
  })();

  return (
    <div id="standphill-pi" className="pi-page">
      {/* ==========================================================
          Decorative Top Ribbon
      ========================================================== */}
      <svg
  className="pi-header-wave"
  viewBox="0 0 1200 80"
  preserveAspectRatio="none"
>
  <path
    d="
      M0 0
      H1200
      V34
      H0
      Z"
    fill="#231B4B"
  />
  <path
    d="
      M730 0
      H1200
      V54
      C1120 52 1020 48 900 42
      C820 38 760 30 730 0
      Z"
    fill="#F4631E"
  />
</svg>
      <div className="pi-watermark">
        STANDPHILL INDIA<sup>®</sup>
      </div>

      {/* ==========================================================
          HEADER
          (Flex allowed only here)
      ========================================================== */}

      <header className="pi-header">
        <div className="pi-header-left">
          <img
            src={logo}
            alt="Standphill India"
            className="pi-logo"
          />

          {/* <div className="pi-brand-text">
            <div className="pi-brand-name">
              <span className="pi-brand-black">
                STANDPHILL
              </span>{" "}
              <span className="pi-brand-orange">
                INDIA
              </span>
            </div>

            <div className="pi-brand-tagline">
              The House of Standards
            </div>
          </div> */}
        </div>

        <div className="pi-header-right">
          <div>
            A-1024, 10th Floor, T-3, NX one, Plot No
          </div>

          <div>
            17, Techzone-4, Greater Noida West-
          </div>

          <div>
            201308, Uttar Pradesh, India.
          </div>

          <div className="pi-contact">
            Mob: +91-9667674225 | Email:
            info@standphillindia.in
          </div>
        </div>
      </header>

      <div className="pi-header-divider" />

      {/* ==========================================================
          TITLE
      ========================================================== */}

      <h1 className="pi-title">
        <span className="pi-title-black">
          {isTax ? "Tax" : "Proforma"}
        </span>{" "}
        <span className="pi-title-orange">
          Invoice
        </span>
      </h1>

      {/* Part-paid PI sent again for the balance */}
      {showReceived && balanceDue > 0 && (
        <div className="pi-reminder-wrap">
          <span className="pi-reminder-tag">
            PAYMENT REMINDER — BALANCE DUE {rupees(balanceDue)}
          </span>
        </div>
      )}

      {/* ==========================================================
          CUSTOMER DETAILS TABLE
      ========================================================== */}

      <table className="pi-table pi-customer-table">
        <colgroup>
          <col style={{ width: "50%" }} />
          <col style={{ width: "50%" }} />
        </colgroup>

        <tbody>
          {/* HEADER ROW */}

          <tr>
            <td className="pi-section-header-cell">
              Customer Details
            </td>

            <td className="pi-section-header-cell pi-right">
              <strong>Date:</strong>{" "}
              {displayDate(invoiceDate)}
              <br />
              <strong>{numberLabel}</strong>{" "}
              {invoiceNo}
            </td>
          </tr>

          {/* DETAILS ROW */}

          <tr>
            {/* CUSTOMER */}

            <td className="pi-detail-cell">
              <div>
                <strong>To,</strong>
              </div>

              <div className="pi-block-gap">
                <strong>Company:</strong>{" "}
                {customer.companyName}
              </div>

              <div className="pi-block-gap">
                <strong>Address:</strong>{" "}
                {customer.address}
              </div>

              <div className="pi-block-gap">
                <strong>GST No:</strong>{" "}
                {customer.gstNo}
              </div>

              {(customer.stateName || customer.stateCode) && (
                <div className="pi-block-gap">
                  <strong>State Name:</strong> {customer.stateName ?? "—"}
                  {"  "}
                  <strong style={{ marginLeft: 12 }}>State Code:</strong> {customer.stateCode ?? "—"}
                </div>
              )}

              <div className="pi-block-gap">
                <strong>Ref:</strong>{" "}
                {customer.reference ? <RefText text={customer.reference} /> : null}
              </div>
            </td>

            {/* SELLER */}

            <td className="pi-detail-cell">
              <div>
                <strong>Company Name:</strong>{" "}
                {seller.companyName}
              </div>

              <div className="pi-block-gap">
                <strong>Address:</strong>{" "}
                {seller.address}
              </div>

              <div className="pi-block-gap">
                <strong>GST NO:</strong>{" "}
                {seller.gstNo}
              </div>

              <div className="pi-block-gap">
                <strong>PAN No.:</strong>{" "}
                {seller.panNo}
              </div>

              {seller.stateName && (
                <div className="pi-block-gap">
                  <strong>State Name:</strong> {seller.stateName}
                  <strong style={{ marginLeft: 12 }}>State Code:</strong> {seller.stateCode ?? ""}
                </div>
              )}

              {/* TI only: the PI it was raised from, side by side like
                  State Name / State Code. */}
              {isTax && sourcePiNumber && (
                <div className="pi-block-gap">
                  <strong>PI No:</strong> {sourcePiNumber}
                  {sourcePiDate && (
                    <>
                      <strong style={{ marginLeft: 12 }}>PI Date:</strong> {displayDate(sourcePiDate)}
                    </>
                  )}
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

            {/* ==========================================================
          ITEMS TABLE
      ========================================================== */}

      <table className={`pi-table pi-items-table ${showQtyRate ? "pi-items-qty" : ""}`}>
        {showQtyRate ? (
          <colgroup>
            <col style={{ width: "44%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
        ) : (
          <colgroup>
            <col style={{ width: "58%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "28%" }} />
          </colgroup>
        )}

        <thead>
          <tr>
            <th className="pi-col-desc">
              Item &amp; Description
            </th>

            <th className="pi-col-hsn">
              HSN/SAC
            </th>

            {showQtyRate && (
              <>
                <th className="pi-col-qty pi-center">Qty</th>
                <th className="pi-col-rate pi-right">Rate [INR]</th>
              </>
            )}

            <th className="pi-col-amount pi-right">
              Amount [INR]
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="pi-item-desc">
                {/* Same numbered-line handling as Ref: a description like
                    "…for: 1. Chairs 2. Tables" prints one product per line. */}
                <RefText text={item.description ?? ""} />
              </td>

              <td className="pi-item-hsn">
                {item.hsnSac}
              </td>

              {showQtyRate && (
                <>
                  <td className="pi-item-qty pi-center">{lineQty(item)}</td>
                  <td className="pi-item-rate pi-right">{lineRate(item).toLocaleString("en-IN")}</td>
                </>
              )}

              <td className="pi-item-amount pi-right">
                {item.amount.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}

          {/* NON TAXABLE */}

          <tr className="pi-bold-row">
            <td colSpan={labelSpan}>
              Nontaxable Amount ({tax.nonTaxableLabel?.trim() || "Government Fee"})
            </td>

            <td className="pi-right">
              {tax.nonTaxableAmount > 0
                ? tax.nonTaxableAmount.toLocaleString("en-IN")
                : ""}
            </td>
          </tr>

          {/* TAXABLE */}

          <tr className="pi-bold-row">
            <td colSpan={labelSpan}>
              Taxable Amount
            </td>

            <td className="pi-right">
              {tax.taxableAmount.toLocaleString("en-IN")}
            </td>
          </tr>

          {/* GST — its own rows, between Taxable Amount and Total */}
          {resolvedTaxType === "CGST_SGST" ? (
            <>
              <tr>
                <td colSpan={labelSpan}>CGST ({formatRate(tax.cgstRate ?? 9)}%)</td>
                <td className="pi-right">{tax.cgst.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td colSpan={labelSpan}>SGST ({formatRate(tax.sgstRate ?? 9)}%)</td>
                <td className="pi-right">{tax.sgst.toLocaleString("en-IN")}</td>
              </tr>
            </>
          ) : (
            <tr>
              <td colSpan={labelSpan}>IGST ({formatRate(tax.igstRate ?? 18)}%)</td>
              <td className="pi-right">{tax.igst.toLocaleString("en-IN")}</td>
            </tr>
          )}

          {/* TOTAL */}

          <tr className="pi-total-row">
            <td colSpan={labelSpan}>
              {tax.nonTaxableAmount > 0 ? "Total Amount (Service + GST + Nontaxable)" : "Total Amount (Service + GST)"}
            </td>

            <td className="pi-right">
              {tax.totalAmount.toLocaleString("en-IN")}
            </td>
          </tr>

          {/* TDS — Tax Invoice only, when the client deducts it */}
          {showTds && (
            <>
              <tr>
                <td colSpan={labelSpan}>
                  Less: TDS @ {formatRate(tdsRate ?? 0)}% (on taxable value {money(tax.taxableAmount)})
                </td>
                <td className="pi-right">
                  {tdsValue.toLocaleString("en-IN")}
                </td>
              </tr>
              <tr className="pi-total-row">
                <td colSpan={labelSpan}>
                  Amount after TDS
                </td>
                <td className="pi-right">
                  {(Math.round((tax.totalAmount - tdsValue) * 100) / 100).toLocaleString("en-IN")}
                </td>
              </tr>
            </>
          )}

          {/* AMOUNT IN WORDS */}
          <tr>
            <td colSpan={labelSpan} style={{ fontSize: "0.92em" }}>
              <strong>Amount Chargeable (in words):</strong> INR {amountInWords(tax.totalAmount)}
            </td>
            <td className="pi-right" style={{ fontSize: "0.85em", fontStyle: "italic" }}>
              E.&amp;O.E
            </td>
          </tr>

          {/* RECEIVED / BALANCE — PI only, once money has come in */}
          {showReceived && (
            <>
              <tr>
                <td colSpan={labelSpan}>
                  Less: Amount Received till date
                  {paymentLines.length > 0 && (
                    <div className="pi-payment-lines">
                      {paymentLines.map((p, i) => (
                        <div key={i}>
                          • {rupees(p.amount)} received on {shortDate(p.paidDate)}
                          {p.paymentMode ? ` (${p.paymentMode})` : ""}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="pi-right">(-) {received.toLocaleString("en-IN")}</td>
              </tr>
              <tr className={`pi-total-row ${balanceDue > 0 ? "pi-balance-due" : "pi-balance-paid"}`}>
                <td colSpan={labelSpan}>
                  {balanceDue > 0 ? "Balance Due (Amount payable now)" : "Balance Due — Fully Paid ✓"}
                </td>
                <td className="pi-right">{balanceDue.toLocaleString("en-IN")}</td>
              </tr>
              {balanceDue > 0 && (
                <tr>
                  <td colSpan={fullSpan} style={{ fontSize: "0.92em" }}>
                    <strong>Balance Due (in words):</strong> INR {amountInWords(balanceDue)}
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>

      {/* ==========================================================
          HSN / SAC TAX SUMMARY
      ========================================================== */}
      <table className="pi-table pi-hsn-table" style={{ marginTop: 8, fontSize: "0.85em" }}>
        <thead>
          {resolvedTaxType === "CGST_SGST" ? (
            <>
              <tr>
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2} className="pi-right">Taxable Value</th>
                <th colSpan={2}>CGST</th>
                <th colSpan={2}>SGST</th>
                <th rowSpan={2} className="pi-right">Total Tax Amount</th>
              </tr>
              <tr>
                <th>Rate</th>
                <th className="pi-right">Amount</th>
                <th>Rate</th>
                <th className="pi-right">Amount</th>
              </tr>
            </>
          ) : (
            <>
              <tr>
                <th rowSpan={2}>HSN/SAC</th>
                <th rowSpan={2} className="pi-right">Taxable Value</th>
                <th colSpan={2}>IGST</th>
                <th rowSpan={2} className="pi-right">Total Tax Amount</th>
              </tr>
              <tr>
                <th>Rate</th>
                <th className="pi-right">Amount</th>
              </tr>
            </>
          )}
        </thead>
        <tbody>
          {hsnRows.map((r) => (
            <tr key={r.code}>
              <td>{r.code}</td>
              <td className="pi-right">{money(r.taxable)}</td>
              {resolvedTaxType === "CGST_SGST" ? (
                <>
                  <td>{formatRate(tax.cgstRate ?? 9)}%</td>
                  <td className="pi-right">{money(r.cgst)}</td>
                  <td>{formatRate(tax.sgstRate ?? 9)}%</td>
                  <td className="pi-right">{money(r.sgst)}</td>
                  <td className="pi-right">{money(r.cgst + r.sgst)}</td>
                </>
              ) : (
                <>
                  <td>{formatRate(tax.igstRate ?? 18)}%</td>
                  <td className="pi-right">{money(r.igst)}</td>
                  <td className="pi-right">{money(r.igst)}</td>
                </>
              )}
            </tr>
          ))}
          <tr className="pi-bold-row">
            <td>Total</td>
            <td className="pi-right">{money(tax.taxableAmount)}</td>
            {resolvedTaxType === "CGST_SGST" ? (
              <>
                <td />
                <td className="pi-right">{money(tax.cgst)}</td>
                <td />
                <td className="pi-right">{money(tax.sgst)}</td>
              </>
            ) : (
              <>
                <td />
                <td className="pi-right">{money(tax.igst)}</td>
              </>
            )}
            <td className="pi-right">{money(taxTotal)}</td>
          </tr>
          <tr>
            <td colSpan={resolvedTaxType === "CGST_SGST" ? 7 : 5} style={{ fontSize: "0.92em" }}>
              <strong>Tax Amount (in words):</strong> INR {amountInWords(taxTotal)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ==========================================================
          BANK DETAILS + SIGNATURE — last block of the invoice, after the
          HSN/SAC summary. GST is printed above as its own rows (between
          Taxable Amount and Total), not inside the signature box.
      ========================================================== */}
      <table className="pi-table" style={{ marginTop: 8 }}>
        <colgroup>
          <col style={{ width: "60%" }} />
          <col style={{ width: "40%" }} />
        </colgroup>
        <tbody>
          <tr className="pi-bank-tax-row">
            <td className="pi-bank-cell">
              <div className="pi-bank-flex">
                <div className="pi-bank-text">
                  <div><strong>Bank Details:</strong></div>
                  <div className="pi-block-gap">
                    <strong>Beneficiary Name:</strong> {bank.beneficiaryName}
                  </div>
                  <div><strong>Bank Name:</strong> {bank.bankName}</div>
                  <div>
                    <strong>A/c No:</strong> {bank.accountNo}, IFSC Code: {bank.ifscCode}
                  </div>
                </div>
                {!isTax && (
                  <div className="pi-bank-qr">
                    <UpiQr amount={tax.totalAmount} note={invoiceNo} alt="Scan to pay via UPI" className="pi-qr-img" />
                    <div className="pi-qr-caption">Scan &amp; Pay (UPI)</div>
                  </div>
                )}
              </div>
            </td>
            <td style={{ verticalAlign: "bottom" }}>
              {signatory && (
                <div className="pi-signature-block">
                  <img src={signatory.imageUrl} alt={`Signature of ${signatory.name}`} className="pi-signature-img" />
                  <div className="pi-signature-name">{signatory.name}</div>
                  <div className="pi-signature-label">Authorised Signatory</div>
                </div>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* ==========================================================
          FOOTER
      ========================================================== */}
     <div className="pi-footer">
      <div className="pi-footer-text">
        <div>
          If you have question about this {documentLabel},
          please write to standphillindia@gmail.com
        </div>

        <div>
          Thank you for your business
        </div>
      </div>

      <div className="pi-footer-note">
         {signatory
           ? "** This document is digitally signed by Standphill India **"
           : "** This document is generated by Standphill INDIA encrypted system software; valid without signature **"}
      </div>
</div>
      {/* ==========================================================
          BOTTOM RIBBON
      ========================================================== */}

      <svg
    className="pi-footer-wave"
    viewBox="0 0 1200 70"
    preserveAspectRatio="none"
>
    <path
        d="M0 70
           H1200
           V34
           C1000 34 840 28 620 70
           Z"
        fill="#241d4d"
    />

    <path
        d="M0 50
           C220 44 430 38 650 50
           H1200
           V56
           H0
           Z"
        fill="#f4631e"
    />
</svg>
    </div>
  );
};

export default ProformaInvoice;