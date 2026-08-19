// src/components/invoice/LeadInvoiceFormModal.tsx
//
// Lead-scoped mirror of ProjectInvoiceFormModal — creates a PI (or a TI
// linked to a paid PI) directly against a LEAD, before any Project exists.
// This is the "Initiate PI" step of the pre-WON finance flow:
//
//   PI created here            → lead auto-moves NEGOTIATION → PI_RAISED
//   full payment recorded      → PAYMENT_RECEIVED  (Payments module)
//   TI generated from that PI  → READY_TO_WON      (Admin task list)
//
// Client details are prefilled from the lead itself.

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  createLeadInvoice,
  // (tax helpers now live in constants/taxConstants)
  getLeadInvoicesWithPayment,
  type InvoiceDetailsResponse,
  type ProjectInvoicePaymentRow,
} from "../../services/invoiceService";
import type { LeadResponse } from "../../services/leadService";
import {
  DEFAULT_GST_RATE,
  detectTaxType,
  calculateTaxBreakdown,
  formatRate,
  type TaxType,
} from "../../constants/taxConstants";

interface LeadInvoiceFormModalProps {
  lead: LeadResponse | null;
  invoiceType: "PROFORMA" | "TAX";
  isOpen: boolean;
  onClose: () => void;
  onCreated: (invoice: InvoiceDetailsResponse) => void;
}

interface LineItem {
  id: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Tax is calculated by the backend on save. The helpers below drive
// the live preview in this form only, and mirror the backend rules.

export default function LeadInvoiceFormModal({
  lead,
  invoiceType,
  isOpen,
  onClose,
  onCreated,
}: LeadInvoiceFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = trust the auto-detection from the GSTIN. Set only when the
  // user deliberately overrides the split; sent to the backend so the
  // server records the same decision the user saw.
  const [taxTypeOverride, setTaxTypeOverride] = useState<TaxType | null>(null);

  // Only relevant when invoiceType="TAX" — link the TI to an existing PI
  // on this same lead (required for the READY_TO_WON auto-advance).
  const [piOptions, setPiOptions] = useState<ProjectInvoicePaymentRow[]>([]);
  const [selectedPiId, setSelectedPiId] = useState<string>("");

  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientGst: "",
    billingAddress: "",
    remarks: "",
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "1",
      description: "Certification Service Charge",
      sacCode: "998393",
      quantity: 1,
      unitPrice: 0,
      amount: 0,
    },
  ]);

  // Prefill client details from the lead each time the modal opens.
  useEffect(() => {
    if (isOpen && lead) {
      setFormData((prev) => ({
        ...prev,
        clientName: lead.companyName || "",
        clientEmail: lead.email || "",
      }));
    }
    if (isOpen && invoiceType === "TAX" && lead) {
      getLeadInvoicesWithPayment(lead.id)
        .then((rows) => setPiOptions(rows.filter((r) => r.invoiceType === "PROFORMA")))
        .catch(() => setPiOptions([]));
    }
    if (!isOpen) {
      setSelectedPiId("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoiceType, lead?.id]);

  if (!isOpen || !lead) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLineItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === "quantity" || field === "unitPrice") {
            updated.amount = Number(updated.quantity) * Number(updated.unitPrice);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { id: Date.now().toString(), description: "", sacCode: "998393", quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setError("At least one line item is required");
    }
  };

  const taxableAmount = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Auto-detected from the client GSTIN, unless the user has picked a
  // split manually. The backend re-runs this same decision on save, so
  // this is a preview — it can never disagree with what gets stored.
  const autoTaxType = detectTaxType(undefined, formData.clientGst);
  const effectiveTaxType: TaxType = taxTypeOverride ?? autoTaxType;

  const tax = calculateTaxBreakdown(taxableAmount, effectiveTaxType, DEFAULT_GST_RATE);
  const taxAmount = tax.taxAmount;
  const totalAmount = tax.totalAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lineItems.some((item) => !item.description || item.unitPrice <= 0)) {
      setError("All line items must have a description and a valid unit price");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const created = await createLeadInvoice(lead.id, invoiceType, {
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientGst: formData.clientGst,
        billingAddress: formData.billingAddress,
        amount: taxableAmount,
        taxableAmount,
        taxAmount,
        totalAmount,
        gstRate: DEFAULT_GST_RATE,
        taxType: effectiveTaxType,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        remarks: formData.remarks,
        sourcePiId: invoiceType === "TAX" && selectedPiId ? selectedPiId : undefined,
        items: lineItems.map((item) => ({
          description: item.description,
          sacCode: item.sacCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })),
      });
      onCreated(created);
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        anyErr?.response?.data?.message ??
          anyErr?.message ??
          `Failed to create ${invoiceType === "PROFORMA" ? "PI" : "TI"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const theme = invoiceType === "PROFORMA"
    ? { from: "from-orange-500", to: "to-orange-600", ring: "focus:ring-orange-500", btn: "bg-orange-600 hover:bg-orange-700" }
    : { from: "from-blue-600", to: "to-blue-700", ring: "focus:ring-blue-500", btn: "bg-blue-600 hover:bg-blue-700" };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
        <div className={`sticky top-0 bg-gradient-to-r ${theme.from} ${theme.to} text-white p-6 flex justify-between items-center`}>
          <h2 className="text-2xl font-bold">
            {invoiceType === "PROFORMA" ? "Initiate PI" : "Create Tax Invoice"} — {lead.companyName}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-black hover:bg-opacity-20 p-1 rounded transition">
            <X size={24} />
          </button>
        </div>

        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-900">
          {invoiceType === "PROFORMA" ? (
            <>
              ℹ️ Creating this PI moves the lead to <strong>PI Raised</strong> automatically. Record its full
              payment in <strong>Payments</strong>, then generate the TI — the lead lands in Admin's{" "}
              <strong>Ready-to-Won</strong> list on its own.
            </>
          ) : (
            <>
              ℹ️ Link this TI to the paid PI below — that's what moves the lead to{" "}
              <strong>Ready to Won</strong> (Admin task list).
            </>
          )}
        </div>

        {invoiceType === "TAX" && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
            <label className="block text-sm font-medium text-blue-900 mb-2">
              Link to PI (required for Ready-to-Won)
            </label>
            <select
              value={selectedPiId}
              onChange={(e) => setSelectedPiId(e.target.value)}
              className="w-full px-4 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Don't link — standalone TI (won't advance the lead)</option>
              {piOptions.map((pi) => (
                <option key={pi.invoiceId} value={pi.invoiceId}>
                  {pi.invoiceNumber} — ₹{pi.totalAmount.toLocaleString()} ({pi.paymentStatus || "PENDING"})
                </option>
              ))}
            </select>
            <p className="text-xs text-blue-700 mt-2">
              The lead only auto-advances to Ready-to-Won when the linked PI is fully PAID — the payment
              gate can't be skipped. (Tip: prefer "Generate TI →" on the PI row itself in Payments.)
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">⚠️ {error}</div>
          )}

          <div className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Client Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input type="text" name="clientName" value={formData.clientName} onChange={handleInputChange}
                  required className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.ring}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" name="clientEmail" value={formData.clientEmail} onChange={handleInputChange}
                  required className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.ring}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number *</label>
                <input type="text" name="clientGst" value={formData.clientGst} onChange={handleInputChange}
                  placeholder="e.g. 07AHNPJ2190E1ZE" required
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.ring}`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address *</label>
                <input type="text" name="billingAddress" value={formData.billingAddress} onChange={handleInputChange}
                  required className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.ring}`} />
              </div>
            </div>
          </div>

          <div className="border-b pb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-gray-700">Line Items</h3>
              <button type="button" onClick={handleAddLineItem}
                className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition">
                <Plus size={16} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-300 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border-b border-r px-3 py-2 text-left">Description</th>
                    <th className="border-b border-r px-3 py-2 text-left">SAC Code</th>
                    <th className="border-b border-r px-3 py-2 text-center w-20">Qty</th>
                    <th className="border-b border-r px-3 py-2 text-right w-24">Unit Price</th>
                    <th className="border-b border-r px-3 py-2 text-right w-24">Amount</th>
                    <th className="border-b px-3 py-2 text-center w-12">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="border-r px-3 py-2">
                        <input type="text" value={item.description}
                          onChange={(e) => handleLineItemChange(item.id, "description", e.target.value)}
                          required className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input type="text" value={item.sacCode}
                          onChange={(e) => handleLineItemChange(item.id, "sacCode", e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input type="number" value={item.quantity} min="1" required
                          onChange={(e) => handleLineItemChange(item.id, "quantity", parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-center" />
                      </td>
                      <td className="border-r px-3 py-2">
                        <input type="number" value={item.unitPrice} step="0.01" min="0" required
                          onChange={(e) => handleLineItemChange(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-right" />
                      </td>
                      <td className="border-r px-3 py-2 text-right font-medium text-gray-700">
                        ₹{item.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button type="button" onClick={() => handleRemoveLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          className="text-red-600 hover:text-red-800 disabled:text-gray-300 transition">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-b pb-4">
            <h3 className="font-semibold text-gray-700 mb-3">Financial Summary</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Type
              </label>
              <select
                value={taxTypeOverride ?? "AUTO"}
                onChange={(e) =>
                  setTaxTypeOverride(
                    e.target.value === "AUTO" ? null : (e.target.value as TaxType)
                  )
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="AUTO">
                  Auto-detect from GSTIN
                  {" — "}
                  {autoTaxType === "CGST_SGST" ? "CGST + SGST" : "IGST"}
                </option>
                <option value="CGST_SGST">CGST + SGST (within Uttar Pradesh)</option>
                <option value="IGST">IGST (outside Uttar Pradesh)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Detected from the client GSTIN. Change this only if the place of
                supply differs from the GSTIN state.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Taxable Amount</p>
                <p className="text-2xl font-bold text-blue-600">₹{taxableAmount.toLocaleString()}</p>
              </div>
              {effectiveTaxType === "CGST_SGST" ? (
                <>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-gray-600 mb-1">CGST ({formatRate(tax.cgstRate)}%)</p>
                    <p className="text-2xl font-bold text-orange-600">₹{tax.cgstAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm text-gray-600 mb-1">SGST ({formatRate(tax.sgstRate)}%)</p>
                    <p className="text-2xl font-bold text-orange-600">₹{tax.sgstAmount.toLocaleString()}</p>
                  </div>
                </>
              ) : (
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <p className="text-sm text-gray-600 mb-1">IGST ({formatRate(tax.igstRate)}%)</p>
                  <p className="text-2xl font-bold text-orange-600">₹{tax.igstAmount.toLocaleString()}</p>
                </div>
              )}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-green-600">₹{totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
            <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={3}
              className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.ring}`} />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button type="submit" disabled={loading}
              className={`flex-1 text-white py-2 rounded-lg transition font-medium ${theme.btn} disabled:bg-gray-400`}>
              {loading ? "Creating..." : invoiceType === "PROFORMA" ? "Create PI & Move Lead to PI Raised" : "Create Tax Invoice"}
            </button>
            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition font-medium">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}