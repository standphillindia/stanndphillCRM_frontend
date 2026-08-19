// src/components/invoice/AmcInvoicePreviewModal.tsx

import { useState } from "react";
import { X, Download, Pencil, Save, Send, Loader2 } from "lucide-react";
import ProformaInvoice from "./ProformaInvoice";
import { downloadElementAsPdf } from "../../utils/downloadInvoice";
import {
  updateAmcInvoiceDetails,
  markInvoiceAsSent,
  type InvoiceDetailsResponse,
  type InvoiceItemResponse,
} from "../../services/invoiceService";
import { SIGNATORIES } from "../../config/signatories";
import {
  DEFAULT_GST_RATE,
  detectTaxType,
  calculateTaxBreakdown,
  type TaxType,
} from "../../constants/taxConstants";

interface Props {
  invoice: InvoiceDetailsResponse;
  onClose: () => void;
  onUpdated: (invoice: InvoiceDetailsResponse) => void;
}

interface EditableItem extends InvoiceItemResponse {
  _key: string;
}

// Same seller identity used elsewhere in the invoice module (Deal PI/TI flow)
const SELLER = {
  companyName: "Standphill India",
  address:
    "Floor No-10, Unit No-A 1024, Tower-3, NX ONE Techzone-4, Nearby Gaur City Mall, Greater Noida, Gautambuddha Nagar, Uttar Pradesh, 201318",
  gstNo: "09AEZFS7173R1ZG",
  panNo: "AEZFS7173R",
};

const BANK = {
  beneficiaryName: "STANDPHILL INDIA",
  bankName: "HDFC BANK",
  accountNo: "50200082603304",
  ifscCode: "HDFC0003987",
};

export default function AmcInvoicePreviewModal({ invoice, onClose, onUpdated }: Props) {
  const isTax = invoice.invoiceType === "TAX";
  const isDraft = invoice.status === "DRAFT";
  const elementId = `preview-invoice-${invoice.id}`;

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientName, setClientName] = useState(invoice.clientName);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [clientGst, setClientGst] = useState(invoice.clientGst);
  const [billingAddress, setBillingAddress] = useState(invoice.billingAddress);
  const [remarks, setRemarks] = useState(invoice.remarks || "");
  const [signatoryName, setSignatoryName] = useState(invoice.signatoryName || "");
  const [items, setItems] = useState<EditableItem[]>(
    invoice.items.map((it) => ({ ...it, _key: it.id }))
  );

  const taxableAmount = items.reduce((sum, it) => sum + (it.amount || 0), 0);

  // Items are editable in this modal, so the tax has to be re-derived as
  // the user types. It used to be a bare Math.round(taxable * 0.18): that
  // hardcoded the rate, always produced IGST, and rounded differently
  // from the create form — so the preview could disagree with the figure
  // actually stored by a rupee.
  //
  // The saved invoice's own taxType is trusted first; only when it's
  // missing (legacy rows) do we fall back to detecting from the GSTIN.
  const effectiveTaxType: TaxType =
    invoice.taxType ?? detectTaxType(invoice.placeOfSupply, clientGst);

  const tax = calculateTaxBreakdown(
    taxableAmount,
    effectiveTaxType,
    invoice.gstRate ?? DEFAULT_GST_RATE
  );

  const taxAmount = tax.taxAmount;
  const totalAmount = tax.totalAmount;

  const handleItemChange = (key: string, field: keyof InvoiceItemResponse, value: string | number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it._key !== key) return it;
        const updated = { ...it, [field]: value };
        if (field === "quantity" || field === "unitPrice") {
          updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAmcInvoiceDetails(invoice.id, {
        invoiceNumber: invoiceNumber.trim() || undefined,
        clientName,
        clientGst,
        billingAddress,
        remarks,
        signatoryName: signatoryName || undefined,
        taxableAmount,
        taxAmount,
        totalAmount,
        gstRate: invoice.gstRate ?? DEFAULT_GST_RATE,
        taxType: effectiveTaxType,
        items: items.map((it) => ({
          description: it.description,
          sacCode: it.sacCode,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          amount: it.amount,
        })),
      });
      onUpdated(updated);
      setEditMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkSent = async () => {
    setSaving(true);
    setError(null);
    try {
      await markInvoiceAsSent(invoice.id);
      onUpdated({ ...invoice, status: "SENT" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark as sent");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadElementAsPdf(elementId, `${invoice.invoiceNumber}.pdf`);
    } catch (err) {
      setError("Failed to generate PDF");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 z-10 text-white p-4 flex justify-between items-center ${isTax ? "bg-blue-700" : "bg-orange-600"}`}>
          <div>
            <h2 className="text-xl font-bold">{invoice.invoiceNumber}</h2>
            <p className="text-sm opacity-90">
              {invoice.invoiceType === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice"} · {invoice.status}
              {invoice.referenceType === "AMC" ? " · AMC" : " · Project"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editMode && (
              <button onClick={() => setEditMode(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-white bg-opacity-20 rounded hover:bg-opacity-30 text-sm font-medium">
                <Pencil size={16} /> Edit
              </button>
            )}
            {editMode && (
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-900 rounded hover:bg-gray-100 text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Changes
              </button>
            )}
            {isDraft && !editMode && (
              <button onClick={handleMarkSent} disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-white bg-opacity-20 rounded hover:bg-opacity-30 text-sm font-medium disabled:opacity-50">
                <Send size={16} /> Mark Sent
              </button>
            )}
            <button onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-gray-900 rounded hover:bg-gray-100 text-sm font-medium">
              <Download size={16} /> Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 p-3 text-sm">⚠️ {error}</div>
        )}

        {!isDraft && !editMode && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 p-3 text-sm">
            ⚠️ This invoice has already been sent. Its invoice number ({invoice.invoiceNumber}) stays the same —
            edit and re-download to correct a mistake without creating a new PI/TI.
          </div>
        )}

        {/* Edit form (shown for both DRAFT and already-SENT invoices) */}
        {editMode && (
          <div className="p-6 bg-gray-50 border-b space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isTax ? "TI No." : "PI No."}
              </label>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              <p className="text-xs text-gray-500 mt-1">Must stay unique across all invoices.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input value={clientGst} onChange={(e) => setClientGst(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
                <input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-300 rounded-lg overflow-hidden bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b border-r px-3 py-2 text-left">Description</th>
                    <th className="border-b border-r px-3 py-2 text-left">SAC</th>
                    <th className="border-b border-r px-3 py-2 text-center w-20">Qty</th>
                    <th className="border-b border-r px-3 py-2 text-right w-28">Unit Price</th>
                    <th className="border-b px-3 py-2 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it._key} className="border-b">
                      <td className="border-r px-3 py-2">
                        <input value={it.description} onChange={(e) => handleItemChange(it._key, "description", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input value={it.sacCode} onChange={(e) => handleItemChange(it._key, "sacCode", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input type="number" value={it.quantity} min={1}
                          onChange={(e) => handleItemChange(it._key, "quantity", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input type="number" value={it.unitPrice} min={0} step="0.01"
                          onChange={(e) => handleItemChange(it._key, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">₹{it.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Signature</label>
              <select value={signatoryName} onChange={(e) => setSignatoryName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option value="">No signature</option>
                {SIGNATORIES.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* The actual visual invoice — what gets captured for the PDF.
            Uses the same ProformaInvoice component (and prop shape) as the
            Deal PI/TI flow, so AMC invoices render pixel-identical. */}
        <div className="p-4 bg-gray-200 flex justify-center overflow-x-auto">
          <div id={elementId} style={{ width: "210mm" }}>
            <ProformaInvoice
              invoiceNo={invoiceNumber}
              invoiceDate={invoice.issueDate}
              invoiceType={invoice.invoiceType}
              signatoryName={signatoryName}
              customer={{
                companyName: clientName,
                address: billingAddress,
                gstNo: clientGst,
                reference: remarks,
              }}
              seller={SELLER}
              items={items.map((it) => ({
                id: it.id,
                description: it.description,
                hsnSac: it.sacCode,
                amount: it.amount,
              }))}
              bank={BANK}
              tax={{
                nonTaxableAmount: 0,
                taxableAmount,
                cgst: tax.cgstAmount,
                sgst: tax.sgstAmount,
                igst: tax.igstAmount,
                totalAmount,
                taxType: effectiveTaxType,
                cgstRate: tax.cgstRate,
                sgstRate: tax.sgstRate,
                igstRate: tax.igstRate,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}