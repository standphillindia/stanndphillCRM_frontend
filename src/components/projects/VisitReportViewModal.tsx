// src/components/projects/VisitReportViewModal.tsx
//
// Read-only view of the engineer's factory-visit paperwork: the document
// checklist (documents marked "No" blink red so Admin sees what is missing)
// and the Basic Information Form.

import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import {
  CHECKLIST_STATUS_LABEL,
  parseBasicInfo,
  type VisitReport,
} from "../../services/visitReportService";

interface Props {
  report: VisitReport;
  canEdit: boolean;
  onClose: () => void;
}

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
      })
    : "";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 text-sm py-1">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 whitespace-pre-line break-words">{value?.trim() ? value : "—"}</span>
    </div>
  );
}

export default function VisitReportViewModal({ report, canEdit, onClose }: Props) {
  const info = report.basicInfoSubmittedAt ? parseBasicInfo(report) : null;
  const missing = report.checklist.filter((r) => r.status === "NO");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900">Factory visit — documents & basic info</h2>
            <p className="text-sm text-gray-500 truncate">{report.projectName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {!report.checklistSubmittedAt ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              The engineer has not filled the document checklist yet.
            </p>
          ) : (
            <section>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Document checklist</h3>
                <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs">Yes {report.checklistYes}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${report.checklistNo ? "bg-red-600 text-white animate-pulse" : "bg-red-100 text-red-800"}`}>
                  No {report.checklistNo}
                </span>
                <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">N.A. {report.checklistNa}</span>
                <span className="text-xs text-gray-500 ml-auto">
                  {report.checklistSubmittedBy} · {when(report.checklistSubmittedAt)}
                </span>
              </div>

              {missing.length > 0 && (
                <div className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <b>{missing.length} document(s) not available:</b> {missing.map((m) => m.document).join(", ")}
                </div>
              )}

              <div className="overflow-x-auto">

              <table className="w-full text-sm">
                <tbody>
                  {report.checklist.map((r, i) => (
                    <tr
                      key={r.no}
                      className={`border-t ${r.status === "NO" ? "bg-red-100 animate-pulse" : ""} ${
                        i > 0 && report.checklist[i - 1].section !== r.section ? "border-t-2 border-gray-300" : ""
                      }`}
                    >
                      <td className="py-1.5 pr-2 text-gray-400 w-8 align-top">{r.no}</td>
                      <td className="py-1.5 pr-2 align-top">
                        {r.document}
                        {r.remark && <span className="block text-xs text-gray-500">{r.remark}</span>}
                      </td>
                      <td className="py-1.5 text-right align-top w-16">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            r.status === "YES" ? "bg-green-100 text-green-800"
                              : r.status === "NO" ? "bg-red-600 text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {r.status ? CHECKLIST_STATUS_LABEL[r.status] : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
</div>
              <div className="mt-3">
                <Row label="Remarks" value={report.checklistRemarks} />
                <Row label="Factory representative" value={report.factoryRepName} />
                <Row label="Standphill representative" value={report.standphillRepName} />
              </div>
            </section>
          )}

          <section>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Basic information</h3>
            {!info ? (
              <p className="text-sm text-gray-500">Not filled yet.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  {report.basicInfoSubmittedBy} · {when(report.basicInfoSubmittedAt)}
                </p>
                <div>
                  <Row label="Company" value={info.companyName} />
                  <Row label="IS No. & product" value={info.productIsNo} />
                  <Row label="Factory address" value={info.factoryAddress} />
                  <Row label="Office address" value={info.officeAddress} />
                  <Row label="Email & contact" value={info.emailContact} />
                  <Row
                    label="Brand name"
                    value={info.brandName + (info.brandRegistered ? ` (registered: ${info.brandRegistered === "YES" ? "Yes" : "No"})` : "")}
                  />
                  <Row label="Scope as per IS" value={info.scopeAsPerIs} />
                  <Row label="Scope requested" value={info.scopeRequested} />
                  <Row label="Weekly off" value={info.weeklyOff} />
                  <Row label="Latitude / longitude" value={info.latitude || info.longitude ? `${info.latitude}, ${info.longitude}` : ""} />
                  <Row label="Installed capacity / month" value={info.installedCapacity} />
                  <Row label="Produced last year" value={info.producedLastYear} />
                  <Row label="Value last year (INR)" value={info.valueLastYear} />
                  <Row label="Cost per unit (INR)" value={info.costPerUnit} />
                </div>

                {[
                  { title: "Top management", rows: info.topManagement, cols: ["name", "designation", "contact", "email"] },
                  { title: "Quality control person(s)", rows: info.qcPersons, cols: ["name", "qualification", "designation", "experience", "contact", "email"] },
                  { title: "Authorised signatory", rows: [info.signatory], cols: ["name", "designation", "contact", "email"] },
                  { title: "Packaging & marking", rows: info.packaging, cols: ["material", "description", "quantity", "marking", "batchCode"] },
                ].map((t) => {
                  const rows = (t.rows as unknown as Record<string, string>[]).filter((r) => t.cols.some((c) => r[c]?.trim()));
                  if (!rows.length) return null;
                  return (
                    <div key={t.title}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{t.title}</p>
                      <ul className="text-sm space-y-1">
                        {rows.map((r, i) => (
                          <li key={i} className="text-gray-800">
                            {t.cols.map((c) => r[c]?.trim()).filter(Boolean).join(" · ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t">
          {canEdit && (
            <Link
              to={`/visit-report/${report.projectId}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {report.checklistSubmittedAt ? "Update" : "Fill now"}
            </Link>
          )}
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}