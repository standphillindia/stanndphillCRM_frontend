// src/modules/payment/pages/ProjectPaymentDetails.tsx
//
// Direct Project-scoped mirror of AmcPaymentDetails.tsx — the "Manage"
// page for a single project's PI/TI + payment tracking. Reached from
// Payments -> List -> "View" on a project row.

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Plus, ArrowLeft, IndianRupee, Receipt } from "lucide-react";
import { getProjectById, type ProjectResponse } from "../../../services/projectService";
import {
  getProjectInvoicesWithPayment,
  getInvoiceDetailsById,
  generateTiFromPi,
  linkTiToPi,
  type ProjectInvoicePaymentRow,
  type InvoiceDetailsResponse,
} from "../../../services/invoiceService";
import ProjectInvoiceFormModal from "../../../components/invoice/ProjectInvoiceFormModal";
import AmcInvoicePreviewModal from "../../../components/invoice/AmcInvoicePreviewModal";
import AddPaymentTransactionModal from "../components/AddPaymentTransactionModal";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-orange-100 text-orange-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
};

export default function ProjectPaymentDetails() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectResponse | null>(null);
  const [rows, setRows] = useState<ProjectInvoicePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showPiForm, setShowPiForm] = useState(false);
  const [showTiForm, setShowTiForm] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceDetailsResponse | null>(null);
  const [recordPaymentFor, setRecordPaymentFor] = useState<ProjectInvoicePaymentRow | null>(null);
  const [generatingTi, setGeneratingTi] = useState<string | null>(null);
  const [linkingTiFor, setLinkingTiFor] = useState<ProjectInvoicePaymentRow | null>(null);
  const [linkTargetPiId, setLinkTargetPiId] = useState<string>("");
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  useEffect(() => {
    if (projectId) loadData(projectId);
  }, [projectId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [projectDetails, invoiceRows] = await Promise.all([
        getProjectById(id),
        getProjectInvoicesWithPayment(id),
      ]);
      setProject(projectDetails);
      setRows(invoiceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project payment details");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    if (projectId) loadData(projectId);
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
      alert("✅ TI generated from this PI!");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate TI");
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
        <button onClick={() => navigate("/payments/list")} className="text-blue-600 hover:text-blue-800 font-medium mb-4">
          ← Back to Payments list
        </button>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">{error}</div>
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <button onClick={() => navigate("/payments/list")} className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium mb-2">
          <ArrowLeft size={16} /> Back to Payments list
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{project.projectName}</h1>
        <p className="text-gray-600 mt-1">
          {project.certificationType || "—"} · {project.stage} · {formatCurrency(project.amount)}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Live finance snapshot — same rollup fields AmcProject shows */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Received</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(project.receivedAmount)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Pending</p>
          <p className="text-xl font-bold text-orange-700 mt-1">{formatCurrency(project.pendingAmount)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Overdue</p>
          <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(project.overdueAmount)}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => setShowPiForm(true)}
          className="flex items-center gap-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm">
          <Plus size={16} /> New PI
        </button>
        <button onClick={() => setShowTiForm(true)}
          className="flex items-center gap-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium text-sm">
          <Plus size={16} /> New TI (standalone, no linked PI)
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <span className="font-semibold">How this works:</span> every PI gets its own payment record.
        Record the payment against a PI here — once it's fully <span className="font-semibold">PAID</span>,
        a "Generate TI" button appears that creates the Tax Invoice linked to that exact PI (same client
        details and items, same invoice number stays with the PI). The project auto-moves out of DRAFT the
        moment its first payment lands.
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">PI / TI — Payment Tracking</h3>
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No PI/TI yet for this project.</div>
        ) : (
          <div className="overflow-x-auto">
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
        )}
      </div>

      <ProjectInvoiceFormModal
        project={project}
        invoiceType="PROFORMA"
        isOpen={showPiForm}
        onClose={() => setShowPiForm(false)}
        onCreated={() => { setShowPiForm(false); refresh(); }}
      />

      <ProjectInvoiceFormModal
        project={project}
        invoiceType="TAX"
        isOpen={showTiForm}
        onClose={() => setShowTiForm(false)}
        onCreated={() => { setShowTiForm(false); refresh(); }}
      />

      {previewInvoice && (
        <AmcInvoicePreviewModal
          invoice={previewInvoice}
          onClose={() => { setPreviewInvoice(null); refresh(); }}
          onUpdated={(updated) => setPreviewInvoice(updated)}
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
