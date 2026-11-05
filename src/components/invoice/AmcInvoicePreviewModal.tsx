// src/components/invoice/AmcInvoicePreviewModal.tsx

import { useState } from "react";
import { X, Download, Pencil, Save, Send, Loader2, Plus, Trash2 } from "lucide-react";
import ProformaInvoice from "./ProformaInvoice";
import { GST_STATES, resolveClientState } from "../../utils/gstStates";
import { downloadElementAsPdf } from "../../utils/downloadInvoice";
import {
  updateAmcInvoiceDetails,
  markInvoiceAsSent,
  type InvoiceDetailsResponse,
  type InvoiceItemResponse,
  TDS_OPTIONS,
} from "../../services/invoiceService";
import { SIGNATORIES } from "../../config/signatories";
import NonTaxableFields, { type NonTaxableValue } from "./NonTaxableFields";
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
  // Accounts can back-date / correct the invoice date and set the client's
  // state (Place of Supply), which decides IGST vs CGST+SGST and is printed
  // as State Name / State Code.
  const [issueDate, setIssueDate] = useState(invoice.issueDate ?? "");
  const [placeOfSupply, setPlaceOfSupply] = useState(
    invoice.placeOfSupply || resolveClientState(null, invoice.clientGst).name || ""
  );
  const [clientGst, setClientGst] = useState(invoice.clientGst);
  const [billingAddress, setBillingAddress] = useState(invoice.billingAddress);
  const [remarks, setRemarks] = useState(invoice.remarks || "");
  const [signatoryName, setSignatoryName] = useState(invoice.signatoryName || "");
  // TDS — TI only (NIL / 2 / 10 %).
  const [tdsRate, setTdsRate] = useState<number>(Number(invoice.tdsRate ?? 0));
  // Billed without GST (government fee, engineer expenses …) — added after GST.
  const [nonTaxable, setNonTaxable] = useState<NonTaxableValue>({
    amount: Number(invoice.nonTaxableAmount ?? 0),
    label: invoice.nonTaxableLabel ?? "",
  });
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
  // If accounts change the client's state, the split follows the new state.
  const stateChanged = (placeOfSupply || "") !== (invoice.placeOfSupply || "");
  const effectiveTaxType: TaxType =
    stateChanged && placeOfSupply
      ? detectTaxType(placeOfSupply, null)
      : invoice.taxType ?? detectTaxType(invoice.placeOfSupply, clientGst);
  const clientState = resolveClientState(placeOfSupply, clientGst);

  const tax = calculateTaxBreakdown(
    taxableAmount,
    effectiveTaxType,
    invoice.gstRate ?? DEFAULT_GST_RATE
  );

  const taxAmount = tax.taxAmount;
  const totalAmount = tax.totalAmount + (nonTaxable.amount || 0);

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

  // Edit can add a line that was missed, or drop one — not only change
  // the existing ones. The save sends the whole list, so the server
  // replaces the invoice's items with exactly what is shown here.
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: "",
        _key: `new-${Date.now()}-${prev.length}`,
        description: "",
        // Most invoices carry one SAC for every line — start from it.
        sacCode: prev[0]?.sacCode ?? "",
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      } as EditableItem,
    ]);
  };

  const handleRemoveItem = (key: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it._key !== key) : prev));
  };

  const handleSave = async () => {
    if (items.some((it) => !it.description.trim() || !(Number(it.unitPrice) > 0))) {
      setError("Every item needs a description and a unit price above 0. Remove empty rows before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAmcInvoiceDetails(invoice.id, {
        invoiceNumber: invoiceNumber.trim() || undefined,
        issueDate: issueDate || undefined,
        placeOfSupply: placeOfSupply || undefined,
        clientName,
        clientGst,
        billingAddress,
        remarks,
        signatoryName: signatoryName || undefined,
        tdsRate: isTax ? tdsRate : undefined,
        nonTaxableAmount: nonTaxable.amount || 0,
        nonTaxableLabel: nonTaxable.label.trim(),
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
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white sm:rounded-lg shadow-xl max-w-5xl w-full h-full sm:h-auto max-h-full sm:max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className={`sticky top-0 z-10 text-white p-3 sm:p-4 flex flex-wrap gap-2 justify-between items-center ${isTax ? "bg-blue-700" : "bg-orange-600"}`}>
          <div>
            <h2 className="text-xl font-bold">{invoice.invoiceNumber}</h2>
            <p className="text-sm opacity-90">
              {invoice.invoiceType === "PROFORMA" ? "Proforma Invoice" : "Tax Invoice"} · {invoice.status}
              {invoice.referenceType === "AMC" ? " · AMC" : " · Project"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            ⚠️ This invoice has already been sent. Use <b>Edit</b> to correct the number, date, client state or
            amounts, then re-download — no new PI/TI is created.
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client State (Place of Supply)
                </label>
                <select value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="">— Take from GST number —</option>
                  {GST_STATES.map((st) => (
                    <option key={st.code} value={st.name}>{st.name} ({st.code})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Uttar Pradesh = CGST + SGST; any other state = IGST.
                </p>
              </div>
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

            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Items</span>
              <button type="button" onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                <Plus size={16} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-300 rounded-lg overflow-hidden bg-white">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b border-r px-3 py-2 text-left">Description</th>
                    <th className="border-b border-r px-3 py-2 text-left">SAC</th>
                    <th className="border-b border-r px-3 py-2 text-center w-20">Qty</th>
                    <th className="border-b border-r px-3 py-2 text-right w-28">Unit Price</th>
                    <th className="border-b border-r px-3 py-2 text-right w-28">Amount</th>
                    <th className="border-b px-3 py-2 text-center w-12"></th>
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
                      <td className="border-r px-3 py-2 text-right font-medium">₹{it.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" title="Remove item" onClick={() => handleRemoveItem(it._key)}
                          disabled={items.length === 1}
                          className="text-red-600 hover:text-red-800 disabled:text-gray-300">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <NonTaxableFields value={nonTaxable} onChange={setNonTaxable} />

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

            {isTax && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TDS</label>
                <select value={tdsRate} onChange={(e) => setTdsRate(Number(e.target.value))}
                  className="w-full md:w-40 px-3 py-2 border border-gray-300 rounded-lg">
                  {TDS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Worked out on the taxable value and printed as "Amount after TDS". Not shown on a PI.
                </p>
              </div>
            )}
          </div>
        )}

        {/* The actual visual invoice — what gets captured for the PDF.
            Uses the same ProformaInvoice component (and prop shape) as the
            Deal PI/TI flow, so AMC invoices render pixel-identical. */}
        <div className="p-2 sm:p-4 bg-gray-200 flex justify-start lg:justify-center overflow-x-auto">
          <div id={elementId} style={{ width: "210mm" }}>
            <ProformaInvoice
              invoiceNo={invoiceNumber}
              invoiceDate={issueDate || invoice.issueDate}
              invoiceType={invoice.invoiceType}
              signatoryName={signatoryName}
              sourcePiNumber={invoice.sourcePiNumber}
              sourcePiDate={invoice.sourcePiDate}
              tdsRate={isTax ? tdsRate : 0}
              tdsAmount={isTax && tdsRate === Number(invoice.tdsRate ?? 0) && taxableAmount === Number(invoice.taxableAmount ?? 0)
                ? invoice.tdsAmount
                : null}
              customer={{
                companyName: clientName,
                address: billingAddress,
                gstNo: clientGst,
                reference: remarks,
                stateName: clientState.name,
                stateCode: clientState.code,
              }}
              seller={{ ...SELLER, stateName: "Uttar Pradesh", stateCode: "09" }}
              items={items.map((it) => ({
                id: it.id,
                description: it.description,
                hsnSac: it.sacCode,
                amount: it.amount,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
              }))}
              bank={BANK}
              tax={{
                nonTaxableAmount: nonTaxable.amount || 0,
                nonTaxableLabel: nonTaxable.label,
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
              payments={invoice.payments ?? []}
              receivedAmount={invoice.receivedAmount ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}