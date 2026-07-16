// src/pages/documents/DocumentsPage.tsx
// Standphill CRM — Documents page
// Frontend-only for now: documentService.ts stores files as in-browser blob
// URLs (real, working preview/download during this session). Once the
// backend is ready, only src/services/documentService.ts needs to change.

import { useEffect, useState, useMemo, useRef } from "react";
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  formatBytes,
  type DocumentResponse,
} from "../../services/documentService";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_ICON,
  type DocumentType,
} from "../../constants/documentConstants";
import { fetchProjects, type ProjectResponse } from "../../services/projectService";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fileIcon(mimeType: string, documentType: DocumentType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "picture_as_pdf";
  return DOCUMENT_TYPE_ICON[documentType] ?? "insert_drive_file";
}

function expiryState(expiryDate?: string | null): "expired" | "soon" | "ok" | null {
  if (!expiryDate) return null;
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}

const EXPIRY_STYLE: Record<string, string> = {
  expired: "bg-error/10 text-error border-error/20",
  soon:    "bg-amber-500/10 text-amber-700 border-amber-500/20",
  ok:      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
};

const inputCls =
  "w-full px-3 py-2.5 bg-surface border border-outline-variant/30 rounded-lg " +
  "text-body-md text-on-surface outline-none " +
  "focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all";

function Field({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-label-caps text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[...Array(6)].map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 bg-secondary-fixed/60 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs,    setDocs]    = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Filters
  const [search,     setSearch]     = useState("");
  const [typeFilter,  setTypeFilter]  = useState<DocumentType | "ALL">("ALL");
  const [showFilters, setShowFilters] = useState(false);

  // Projects (for linking, real API — projects module is already live)
  const [projects, setProjects] = useState<ProjectResponse[]>([]);

  // Upload modal
  const [showUpload,    setShowUpload]    = useState(false);
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploadType,     setUploadType]     = useState<DocumentType>("BIS_CERTIFICATE");
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [uploadDesc,      setUploadDesc]      = useState("");
  const [uploadExpiry,    setUploadExpiry]    = useState("");
  const [uploadError,     setUploadError]     = useState<string | null>(null);
  const [uploadLoading,   setUploadLoading]   = useState(false);
  const [dragActive,      setDragActive]      = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview
  const [previewDoc, setPreviewDoc] = useState<DocumentResponse | null>(null);

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load documents ────────────────────────────────────────────────────────
  const loadDocs = async () => {
    setLoading(true);
    setPageError(null);
    try {
      const data = await fetchDocuments({
        search: search || undefined,
        documentType: typeFilter,
      });
      setDocs(data);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setPageError(err?.message ?? "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => loadDocs(), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, typeFilter]);

  // Load projects once, for the upload modal's "link to project" dropdown
  useEffect(() => {
    fetchProjects({ page: 0, size: 100 })
      .then((res) => setProjects(res.content))
      .catch(() => setProjects([]));
  }, []);

  // ── Upload ─────────────────────────────────────────────────────────────────
  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadType("BIS_CERTIFICATE");
    setUploadProjectId("");
    setUploadDesc("");
    setUploadExpiry("");
    setUploadError(null);
  };

  const openUpload = () => { resetUploadForm(); setShowUpload(true); };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setUploadFile(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) { setUploadError("Please choose a file to upload"); return; }

    setUploadLoading(true); setUploadError(null);
    try {
      const project = projects.find((p) => p.id === uploadProjectId);
      await uploadDocument({
        file: uploadFile,
        documentType: uploadType,
        projectId: uploadProjectId || undefined,
        projectName: project?.projectName,
        description: uploadDesc.trim() || undefined,
        expiryDate: uploadExpiry || undefined,
      });
      setShowUpload(false);
      resetUploadForm();
      loadDocs();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setUploadError(err?.message ?? "Failed to upload document.");
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try { await deleteDocument(deleteId); setDeleteId(null); loadDocs(); }
    catch { /* ignore */ }
    finally { setDeleteLoading(false); }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const expired = docs.filter((d) => expiryState(d.expiryDate) === "expired").length;
    const soon    = docs.filter((d) => expiryState(d.expiryDate) === "soon").length;
    const totalSize = docs.reduce((sum, d) => sum + d.fileSize, 0);
    return { total: docs.length, expired, soon, totalSize };
  }, [docs]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[1440px] mx-auto space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-headline-lg font-semibold text-on-surface">Documents</h3>
          <p className="text-body-md text-secondary mt-0.5">
            {loading ? "Loading…" : `${docs.length} documents · ${formatBytes(stats.totalSize)}`}
          </p>
        </div>
        <button
          onClick={openUpload}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
            rounded-lg text-body-md font-semibold shadow-sm
            hover:opacity-90 active:scale-95 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span>
          Upload Document
        </button>
      </div>

      {/* ── Search + filter bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by file name, project…"
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant/30
              rounded-lg text-body-md text-on-surface outline-none
              focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="md:col-span-8 flex flex-wrap items-center gap-3">
          <div
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer
              border text-body-sm font-semibold transition-colors
              ${showFilters
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container-low border-outline-variant/20 text-on-surface hover:bg-surface-container"
              }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Type{typeFilter !== "ALL" ? `: ${DOCUMENT_TYPE_LABEL[typeFilter]}` : ": All"}
          </div>

          {showFilters && (
            <>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as DocumentType | "ALL")}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant/20
                  rounded-lg text-body-sm text-on-surface outline-none
                  focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
              >
                <option value="ALL">All Types</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              {typeFilter !== "ALL" && (
                <button
                  onClick={() => setTypeFilter("ALL")}
                  className="text-body-sm text-error hover:underline"
                >
                  Clear filter
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Error bar ──────────────────────────────────────────────────────── */}
      {pageError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-error-container/40
          border border-error/20 rounded-lg text-body-sm text-error">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {pageError}
          <button onClick={() => loadDocs()} className="ml-auto text-body-sm font-semibold hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────────────────────── */}
      <div className="glass-card rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-highest/30 border-b border-outline-variant/20">
                {["File", "Type", "Project", "Uploaded", "Expiry", "Actions"].map((h) => (
                  <th key={h} className="px-6 py-4 text-label-caps text-outline uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                [...Array(4)].map((_, i) => <SkeletonRow key={i} />)
              ) : docs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex flex-col items-center gap-3 py-16 text-secondary">
                      <span
                        className="material-symbols-outlined text-[48px] text-outline"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 48" }}
                      >
                        folder_off
                      </span>
                      <p className="text-body-md">
                        No documents found.
                        {search || typeFilter !== "ALL" ? " Try clearing your filters." : ""}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                docs.map((doc) => {
                  const exp = expiryState(doc.expiryDate);
                  const uploadedDate = new Date(doc.uploadedAt).toLocaleDateString("en-IN");

                  return (
                    <tr key={doc.id} className="hover:bg-primary/[0.02] transition-colors group">
                      {/* File */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px] text-primary">
                              {fileIcon(doc.mimeType, doc.documentType)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-body-md font-semibold text-on-surface leading-tight truncate max-w-[220px]">
                              {doc.fileName}
                            </p>
                            <p className="text-[11px] text-outline mt-0.5">
                              {formatBytes(doc.fileSize)} · {doc.uploadedBy}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold
                          border uppercase tracking-tight bg-tertiary/10 text-tertiary border-tertiary/20">
                          {DOCUMENT_TYPE_LABEL[doc.documentType]}
                        </span>
                      </td>

                      {/* Project */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {doc.projectName || "—"}
                      </td>

                      {/* Uploaded */}
                      <td className="px-6 py-4 text-body-md text-secondary whitespace-nowrap">
                        {uploadedDate}
                      </td>

                      {/* Expiry */}
                      <td className="px-6 py-4">
                        {doc.expiryDate ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold
                            border uppercase tracking-tight ${EXPIRY_STYLE[exp ?? "ok"]}`}>
                            {exp === "expired" ? "Expired" : exp === "soon" ? "Expiring Soon" : "Valid"}
                            {" · "}
                            {new Date(doc.expiryDate).toLocaleDateString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-body-sm text-outline">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            title="Preview"
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                          <a
                            href={doc.fileUrl}
                            download={doc.fileName}
                            title="Download"
                            className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </a>
                          <button
                            onClick={() => setDeleteId(doc.id)}
                            title="Delete"
                            className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Mini stats bento ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Documents", value: stats.total,                sub: "All files",     color: "text-primary"     },
          { label: "Storage Used",    value: formatBytes(stats.totalSize), sub: "This session",  color: "text-tertiary"    },
          { label: "Expiring Soon",   value: stats.soon,                  sub: "Within 30 days", color: "text-amber-700"   },
          { label: "Expired",         value: stats.expired,               sub: "Needs renewal",  color: "text-error"       },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4">
            <p className="text-label-caps text-outline uppercase mb-1">{stat.label}</p>
            <div className="flex items-end justify-between">
              <h3 className={`text-headline-lg font-bold ${stat.color}`}>{stat.value}</h3>
              <span className="text-body-sm text-secondary mb-0.5">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* ── Upload Modal ─────────────────────────────────────────────────── */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowUpload(false)}
        >
          <div
            className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-2 border-b border-outline-variant/10 flex items-center justify-between">
              <div>
                <h2 className="text-headline-md font-semibold text-on-surface">Upload Document</h2>
                <p className="text-body-sm text-secondary mt-0.5">Add a new file to the library</p>
              </div>
              <button
                onClick={() => setShowUpload(false)}
                className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-6 space-y-5">
              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-lg border-2 border-dashed
                  cursor-pointer transition-colors
                  ${dragActive ? "border-primary bg-primary/5" : "border-outline-variant/40 hover:bg-surface-container-low"}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                />
                <span className="material-symbols-outlined text-[32px] text-outline">
                  {uploadFile ? "task" : "cloud_upload"}
                </span>
                {uploadFile ? (
                  <>
                    <p className="text-body-md font-medium text-on-surface">{uploadFile.name}</p>
                    <p className="text-body-sm text-secondary">{formatBytes(uploadFile.size)} · Click to change</p>
                  </>
                ) : (
                  <>
                    <p className="text-body-md font-medium text-on-surface">Click to browse or drag a file here</p>
                    <p className="text-body-sm text-secondary">PDF, image, or document — any type</p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Document Type" icon="category">
                  <select
                    required
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value as DocumentType)}
                    className={inputCls}
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Linked Project (Optional)" icon="work">
                  <select
                    value={uploadProjectId}
                    onChange={(e) => setUploadProjectId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.projectName}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Expiry Date (Optional)" icon="event_busy">
                  <input
                    type="date"
                    value={uploadExpiry}
                    onChange={(e) => setUploadExpiry(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="Description (Optional)" icon="notes">
                  <input
                    type="text"
                    placeholder="Short note about this file"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>

              {uploadError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-error-container/40
                  border border-error/20 rounded-lg text-body-sm text-error">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {uploadError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                    text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary
                    rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
                >
                  {uploadLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">upload_file</span>
                      Upload
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Preview Modal ─────────────────────────────────────────────────── */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="glass-card w-full max-w-3xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-outline-variant/10 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <h2 className="text-headline-md font-semibold text-on-surface truncate">{previewDoc.fileName}</h2>
                <p className="text-body-sm text-secondary mt-0.5">{formatBytes(previewDoc.fileSize)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={previewDoc.fileUrl}
                  download={previewDoc.fileName}
                  className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
                  title="Download"
                >
                  <span className="material-symbols-outlined text-[20px]">download</span>
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-full hover:bg-surface-container-high text-secondary transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-surface-container-low flex items-center justify-center p-4">
              {previewDoc.mimeType.startsWith("image/") ? (
                <img src={previewDoc.fileUrl} alt={previewDoc.fileName} className="max-w-full max-h-[70vh] rounded-lg shadow-sm" />
              ) : previewDoc.mimeType === "application/pdf" ? (
                <iframe src={previewDoc.fileUrl} title={previewDoc.fileName} className="w-full h-[70vh] rounded-lg bg-white" />
              ) : (
                <div className="flex flex-col items-center gap-3 py-16 text-secondary">
                  <span className="material-symbols-outlined text-[48px] text-outline">description</span>
                  <p className="text-body-md">Preview not available for this file type.</p>
                  <a
                    href={previewDoc.fileUrl}
                    download={previewDoc.fileName}
                    className="text-body-sm text-primary font-semibold hover:underline"
                  >
                    Download to view
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      {deleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="glass-card w-full max-w-sm rounded-xl p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span
                className="material-symbols-outlined text-[28px] text-error"
                style={{ fontVariationSettings: "'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48" }}
              >
                delete
              </span>
            </div>
            <h3 className="text-headline-md font-semibold text-on-surface mb-2">Delete this document?</h3>
            <p className="text-body-md text-secondary mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2.5 bg-surface-container-highest border border-outline-variant
                  text-on-surface rounded-lg text-body-md font-medium hover:bg-surface-variant transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2.5 bg-error text-on-error
                  rounded-lg text-body-md font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {deleteLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                    Yes, Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}