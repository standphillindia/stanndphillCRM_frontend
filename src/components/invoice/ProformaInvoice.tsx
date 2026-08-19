import React from "react";
import "./InvoiceStyles.css";
import UpiQr from "./UpiQr";
import logo from "../../assets/invoicelogo.png";
import { getSignatoryByName } from "../../config/signatories";
import { formatRate, type TaxType } from "../../constants/taxConstants";

export interface CustomerDetails {
  companyName: string;
  address: string;
  gstNo?: string;
  reference?: string;
}

export interface SellerDetails {
  companyName: string;
  address: string;
  gstNo: string;
  panNo: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  hsnSac: string;
  amount: number;
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
}

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
}) => {
  const isTax = invoiceType === "TAX";

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
              {invoiceDate}
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

              <div className="pi-block-gap">
                <strong>Ref:</strong>{" "}
                {customer.reference}
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
            </td>
          </tr>
        </tbody>
      </table>

            {/* ==========================================================
          ITEMS TABLE
      ========================================================== */}

      <table className="pi-table pi-items-table">
        <colgroup>
          <col style={{ width: "58%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "28%" }} />
        </colgroup>

        <thead>
          <tr>
            <th className="pi-col-desc">
              Item &amp; Description
            </th>

            <th className="pi-col-hsn">
              HSN/SAC
            </th>

            <th className="pi-col-amount pi-right">
              Amount [INR]
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="pi-item-desc">
                {item.description}
              </td>

              <td className="pi-item-hsn">
                {item.hsnSac}
              </td>

              <td className="pi-item-amount pi-right">
                {item.amount.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}

          {/* NON TAXABLE */}

          <tr className="pi-bold-row">
            <td colSpan={2}>
              Nontaxable Amount (Government Fee)
            </td>

            <td className="pi-right">
              {tax.nonTaxableAmount > 0
                ? tax.nonTaxableAmount.toLocaleString("en-IN")
                : ""}
            </td>
          </tr>

          {/* TAXABLE */}

          <tr className="pi-bold-row">
            <td colSpan={2}>
              Taxable Amount
            </td>

            <td className="pi-right">
              {tax.taxableAmount.toLocaleString("en-IN")}
            </td>
          </tr>

          {/* BANK + GST */}

          <tr className="pi-bank-tax-row">
            {/* BANK */}

            <td className="pi-bank-cell">
              <div className="pi-bank-flex">
                <div className="pi-bank-text">
              <div>
                <strong>Bank Details:</strong>
              </div>

              <div className="pi-block-gap">
                <strong>Beneficiary Name:</strong>{" "}
                {bank.beneficiaryName}
              </div>

              <div>
                <strong>Bank Name:</strong>{" "}
                {bank.bankName}
              </div>

              <div>
                <strong>A/c No:</strong>{" "}
                {bank.accountNo},
                {" "}
                IFSC Code:
                {" "}
                {bank.ifscCode}
              </div>
                </div>
                <div className="pi-bank-qr">
                  <UpiQr
                    amount={tax.totalAmount}
                    note={invoiceNo}
                    alt="Scan to pay via UPI"
                    className="pi-qr-img"
                  />
                  <div className="pi-qr-caption">Scan &amp; Pay (UPI)</div>
                </div>
              </div>
            </td>

            {/* GST TABLE */}

            <td
              className="pi-tax-cell"
              colSpan={2}
            >
              <table className="pi-tax-subtable">
                <tbody>
                  {resolvedTaxType === "CGST_SGST" ? (
                    <>
                      <tr>
                        <td className="pi-tax-label">
                          CGST ({formatRate(tax.cgstRate ?? 9)}%)
                        </td>

                        <td className="pi-tax-value pi-right">
                          {tax.cgst.toLocaleString("en-IN")}
                        </td>
                      </tr>

                      <tr>
                        <td className="pi-tax-label">
                          SGST ({formatRate(tax.sgstRate ?? 9)}%)
                        </td>

                        <td className="pi-tax-value pi-right">
                          {tax.sgst.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="pi-tax-label">
                        IGST ({formatRate(tax.igstRate ?? 18)}%)
                      </td>

                      <td className="pi-tax-value pi-right">
                        {tax.igst.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Signature sits in this same cell, directly beside the UPI
                  QR block. It used to float below the whole table, which
                  left a large gap on short invoices and pushed the footer
                  onto a second page. */}
              {signatory && (
                <div className="pi-signature-block">
                  <img
                    src={signatory.imageUrl}
                    alt={`Signature of ${signatory.name}`}
                    className="pi-signature-img"
                  />
                  <div className="pi-signature-name">
                    {signatory.name}
                  </div>
                  <div className="pi-signature-label">
                    Authorised Signatory
                  </div>
                </div>
              )}
            </td>
          </tr>

          {/* TOTAL */}

          <tr className="pi-total-row">
            <td colSpan={2}>
              Total Amount
            </td>

            <td className="pi-right">
              {tax.totalAmount.toLocaleString("en-IN")}
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