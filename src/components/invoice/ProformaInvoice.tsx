import React from "react";
import "./InvoiceStyles.css";
import logo from "../../assets/invoicelogo.png";

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
}

export interface ProformaInvoiceProps {
  invoiceNo: string;
  invoiceDate: string;

  customer: CustomerDetails;
  seller: SellerDetails;

  items: InvoiceItem[];

  bank: BankDetails;
  tax: TaxDetails;
}

const ProformaInvoice: React.FC<ProformaInvoiceProps> = ({
  invoiceNo,
  invoiceDate,
  customer,
  seller,
  items,
  bank,
  tax,
}) => {
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
          Proforma
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
              <strong>PI No:</strong>{" "}
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
            </td>

            {/* GST TABLE */}

            <td
              className="pi-tax-cell"
              colSpan={2}
            >
              <table className="pi-tax-subtable">
                <tbody>
                  <tr>
                    <td className="pi-tax-label">
                      CGST (9%)
                    </td>

                    <td className="pi-tax-value pi-right">
                      {tax.cgst.toLocaleString("en-IN")}
                    </td>
                  </tr>

                  <tr>
                    <td className="pi-tax-label">
                      SGST (9%)
                    </td>

                    <td className="pi-tax-value pi-right">
                      {tax.sgst.toLocaleString("en-IN")}
                    </td>
                  </tr>

                  <tr>
                    <td className="pi-tax-label">
                      IGST (18%)
                    </td>

                    <td className="pi-tax-value pi-right">
                      {tax.igst.toLocaleString("en-IN")}
                    </td>
                  </tr>
                </tbody>
              </table>
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
          If you have question about Performa Invoice,
          please write to standphillindia@gmail.com
        </div>

        <div>
          Thank you for your business
        </div>
      </div>

      <div className="pi-footer-note">
         ** This document is generated by Standphill INDIA encrypted system software; valid without signature **
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