// src/modules/payment/pages/IndependentProjectDetails.tsx
//
// Reached via /payments/independent/:independentProjectId. Direct mirror of
// ProjectPaymentDetails.tsx — same PI -> Payment -> TI mechanics, just
// scoped to a lightweight IndependentProject container instead of a real
// Project.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Plus, ArrowLeft, IndianRupee, Receipt, Pencil } from "lucide-react";
import {
  getIndependentProjectById,
  getIndependentProjectInvoicesWithPayment,
  getInvoiceDetailsById,
  generateTiFromPi,
  linkTiToPi,
  type IndependentProjectDetailsResponse,
  type ProjectInvoicePaymentRow,
  type InvoiceDetailsResponse,
} from "../../../services/invoiceService";
import IndependentInvoiceFormModal from "../../../components/invoice/IndependentInvoiceFormModal";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import AddPaymentTransactionModal from "../components/AddPaymentTransactionModal";
import PaymentsReceivedModal from "../components/PaymentsReceivedModal";
import InvoiceRowCards from "../../../components/invoice/InvoiceRowCards";
import CreateIndependentProjectModal from "../../../components/invoice/CreateIndependentProjectModal";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export default function IndependentProjectDetails() {
  const { independentProjectId } = useParams<{ independentProjectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<IndependentProjectDetailsResponse | null>(null);
  const [rows, setRows] = useState<ProjectInvoicePaymentRow[]>([]);
  // A long project name (a whole scope line) is cut to 2 lines with "Read more".
  const [showFullName, setShowFullName] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPiForm, setShowPiForm] = useState(false);
  const [showTiForm, setShowTiForm] = useState(false);
  // Edit the record's own details (name, client, contract, carried forward).
  const [showEdit, setShowEdit] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);
  const [recordPaymentFor, setRecordPaymentFor] = useState<ProjectInvoicePaymentRow | null>(null);
  // "Payments received" (date, reference no., edit) for this PI.
  const [paymentsFor, setPaymentsFor] = useState<ProjectInvoicePaymentRow | null>(null);
  const [generatingTi, setGeneratingTi] = useState<string | null>(null);
  const [linkingTiFor, setLinkingTiFor] = useState<ProjectInvoicePaymentRow | null>(null);
  const [linkTargetPiId, setLinkTargetPiId] = useState<string>("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  useEffect(() => {
    if (independentProjectId) loadData(independentProjectId);
  }, [independentProjectId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [projectDetails, invoiceRows] = await Promise.all([
        getIndependentProjectById(id),
        getIndependentProjectInvoicesWithPayment(id),
      ]);
      setProject(projectDetails);
      setRows(invoiceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load independent project details");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    if (independentProjectId) loadData(independentProjectId);
  };

  const openPreview = async (invoiceId: string) => {
    try {
      const details = await getInvoiceDetailsById(invoiceId);
      setPreviewInvoice(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open invoice");
    }
  };

  const handleGenerateTi = async (piId: string) => {
    setGeneratingTi(piId);
    setError(null);
    try {
      await generateTiFromPi(piId);
      refresh();
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(anyErr?.response?.data?.message ?? anyErr?.message ?? "Failed to generate TI");
    } finally {
      setGeneratingTi(null);
    }
  };

  const handleLinkTi = async () => {
    if (!linkingTiFor || !linkTargetPiId) return;
    setLinkSubmitting(true);
    setError(null);
    try {
      await linkTiToPi(linkingTiFor.invoiceId, linkTargetPiId);
      setLinkingTiFor(null);
      setLinkTargetPiId("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link TI to PI");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return "₹0";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="p-6">
        <button onClick={() => navigate("/payments/independent")} className="text-blue-600 hover:text-blue-800 font-medium mb-4">
          ← Back to Independent Projects
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="p-0 lg:p-6 space-y-4 lg:space-y-6">
      <div>
        <button onClick={() => navigate("/payments/independent")} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium mb-2">
          <ArrowLeft size={16} /> Back to Independent Projects
        </button>
        <h1
          title={project.projectName}
          className={`text-xl lg:text-2xl font-bold text-gray-900 break-words ${showFullName ? "" : "line-clamp-2"}`}
        >
          {project.projectName}
        </h1>
        {(project.projectName?.length ?? 0) > 90 && (
          <button
            type="button"
            onClick={() => setShowFullName((v) => !v)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {showFullName ? "Show less" : "Read more"}
          </button>
        )}
        <p className="text-gray-600 mt-1 flex items-center gap-2 flex-wrap">
          {project.clientName}
          {project.certificationType && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {project.certificationType}
            </span>
          )}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Contract: {project.contractAmount ? formatCurrency(project.contractAmount) : "Not set"} · Received: {formatCurrency(project.totalReceived)} · Pending: {formatCurrency(project.totalPending)}
          {project.carriedForwardReceivedAmount > 0 && (
            <> · <span className="text-gray-400">(incl. {formatCurrency(project.carriedForwardReceivedAmount)} carried forward from before CRM)</span></>
          )}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex flex-wrap gap-3">
        <button onClick={() => setShowEdit(true)}
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg hover:bg-gray-50 font-medium text-sm">
          <Pencil size={16} /> Edit details
        </button>

        {/* Always available — the next PI (PI-2, Final …) can be raised
            after the first one; each has its own payment and TI. */}
        <button onClick={() => setShowPiForm(true)}
          className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm">
          <Plus size={16} /> {rows.some((r) => r.invoiceType === "PROFORMA") ? "New PI" : "Create PI"}
        </button>

        {rows.some((r) => r.invoiceType === "PROFORMA") && (
          <button onClick={() => setShowTiForm(true)}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm">
            <Plus size={16} /> New TI (manual)
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">PI / TI — Payment Tracking</h3>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            No PI raised yet for this record. Use the button above to create it.
          </div>
        ) : (
          <>
          {/* Phone / tablet: one card per PI / TI. The table is for laptops. */}
          <div className="lg:hidden">
            <InvoiceRowCards
              rows={rows}
              generatingTi={generatingTi}
              onPreview={openPreview}
              onRecordPayment={(row) => setRecordPaymentFor(row)}
              onGenerateTi={handleGenerateTi}
              onLinkTi={(row) => { setLinkingTiFor(row); setLinkTargetPiId(""); }}
              onViewPayments={(row) => setPaymentsFor(row)}
            />
          </div>
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Invoice</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Total</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Received</th>
                  <th className="px-6 py-3 text-right font-semibold text-gray-700">Pending</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((row) => (
                  <tr key={row.invoiceId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {row.invoiceNumber}
                      {row.invoiceType === "TAX" && row.sourcePiNumber && (
                        <p className="text-xs text-gray-500 font-normal mt-0.5">
                          Linked to {row.sourcePiNumber} — same payment, shown here for reference only
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${row.invoiceType === "PROFORMA" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                        {row.invoiceType === "PROFORMA" ? <FileText size={12} /> : <Receipt size={12} />}
                        {row.invoiceType === "PROFORMA" ? "PI" : "TI"}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">{row.invoiceStatus}</span>
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">{formatCurrency(row.totalAmount)}</td>
                    <td className="px-6 py-4 text-right text-green-700">
                      {row.paidAmount != null ? formatCurrency(row.paidAmount) : "—"}
                      {row.invoiceType === "PROFORMA" && row.paymentId && (row.paidAmount ?? 0) > 0 && (
                        <button onClick={() => setPaymentsFor(row)}
                          className="block ml-auto mt-0.5 text-xs font-medium text-blue-700 hover:text-blue-900 underline">
                          View payments
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-orange-700">
                      {row.dueAmount != null ? formatCurrency(row.dueAmount) : "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {row.paymentStatus ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[row.paymentStatus]}`}>
                          {row.paymentStatus}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-3">
                      <button onClick={() => openPreview(row.invoiceId)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                        Preview →
                      </button>
                      {row.invoiceType === "PROFORMA" && row.paymentStatus !== "PAID" && (
                        <button onClick={() => setRecordPaymentFor(row)}
                          className="inline-flex items-center gap-1 text-green-700 hover:text-green-900 font-medium text-sm">
                          <IndianRupee size={14} /> Record Payment
                        </button>
                      )}
                      {row.invoiceType === "PROFORMA" && row.paymentStatus === "PAID" && (
                        <button onClick={() => handleGenerateTi(row.invoiceId)}
                          disabled={generatingTi === row.invoiceId}
                          className="text-indigo-700 hover:text-indigo-900 font-medium text-sm disabled:opacity-50">
                          {generatingTi === row.invoiceId ? "Generating..." : "Generate TI →"}
                        </button>
                      )}
                      {row.invoiceType === "TAX" && !row.sourcePiId && (
                        <button onClick={() => { setLinkingTiFor(row); setLinkTargetPiId(""); }}
                          className="text-purple-700 hover:text-purple-900 font-medium text-sm">
                          Link to PI
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      <CreateIndependentProjectModal
        isOpen={showEdit}
        existing={showEdit ? project : null}
        onClose={() => setShowEdit(false)}
        onCreated={() => { setShowEdit(false); refresh(); }}
      />

      <IndependentInvoiceFormModal
        independentProjectId={project.id}
        prefillClientName={project.clientName}
        prefillClientEmail={project.clientEmail}
        prefillClientGst={project.clientGst}
        prefillBillingAddress={project.billingAddress}
        contractAmount={project.contractAmount}
        totalReceived={project.totalReceived}
        totalPending={project.totalPending}
        invoiceType="PROFORMA"
        isOpen={showPiForm}
        onClose={() => setShowPiForm(false)}
        onCreated={() => { setShowPiForm(false); refresh(); }}
      />

      <IndependentInvoiceFormModal
        independentProjectId={project.id}
        prefillClientName={project.clientName}
        prefillClientEmail={project.clientEmail}
        prefillClientGst={project.clientGst}
        prefillBillingAddress={project.billingAddress}
        contractAmount={project.contractAmount}
        totalReceived={project.totalReceived}
        totalPending={project.totalPending}
        invoiceType="TAX"
        isOpen={showTiForm}
        onClose={() => setShowTiForm(false)}
        onCreated={() => { setShowTiForm(false); refresh(); }}
      />

      {previewInvoice && (
        <AmcInvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => { setPreviewInvoice(null); refresh(); }}
          onUpdated={(updated) => {
            setPreviewInvoice(updated);
            // Editing a PI's amount also rewrites its Payment record on the
            // server (see InvoiceService.syncPaymentToInvoice). The table
            // below reads Total/Received/Pending from that Payment, not
            // from the invoice — so it has to be refetched, otherwise the
            // modal shows the new figure while the row keeps the old one.
            if (independentProjectId) loadData(independentProjectId);
          }}
        />
      )}

      {paymentsFor && paymentsFor.paymentId && (
        <PaymentsReceivedModal
          paymentId={paymentsFor.paymentId}
          invoiceNumber={paymentsFor.invoiceNumber}
          totalAmount={paymentsFor.totalAmount}
          onClose={() => setPaymentsFor(null)}
          onChanged={refresh}
        />
      )}

      {recordPaymentFor && recordPaymentFor.paymentId && (
        <AddPaymentTransactionModal
          paymentId={recordPaymentFor.paymentId}
          isOpen={true}
          onClose={() => setRecordPaymentFor(null)}
          onSuccess={() => { setRecordPaymentFor(null); refresh(); }}
        />
      )}

      {linkingTiFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Link {linkingTiFor.invoiceNumber} to a PI
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This TI's Received/Pending/Status will start mirroring the selected PI's actual payment —
              same money, shown on both rows, never counted twice.
            </p>
            <select
              value={linkTargetPiId}
              onChange={(e) => setLinkTargetPiId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm mb-4"
            >
              <option value="">Select a PI…</option>
              {rows
                .filter((r) => r.invoiceType === "PROFORMA")
                .map((pi) => (
                  <option key={pi.invoiceId} value={pi.invoiceId}>
                    {pi.invoiceNumber} — {formatCurrency(pi.totalAmount)} ({pi.paymentStatus || "PENDING"})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setLinkingTiFor(null); setLinkTargetPiId(""); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkTi}
                disabled={!linkTargetPiId || linkSubmitting}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {linkSubmitting ? "Linking..." : "Link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}