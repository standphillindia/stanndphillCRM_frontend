// src/services/documentService.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW THIS FILE WORKS (same pattern as userService.ts / permissionService.ts)
// ─────────────────────────────────────────────────────────────────────────────
// Backend for /api/documents is NOT ready yet. Every exported function has a
// MOCK implementation (active now) and a REAL implementation (commented,
// ready to uncomment) using the shared `api` axios instance.
//
// One extra detail specific to this module: since there's no backend to
// actually store files, uploadDocument() uses the browser's built-in
// URL.createObjectURL() to generate a real, working local preview/download
// link for the file the user picks. This means Upload + Preview + Download
// genuinely work in the browser right now — the only thing that's "fake" is
// that the file lives in browser memory instead of on a server, so it won't
// survive a page refresh and isn't shared with other users. That's expected
// for a frontend-only stage.
//
// WHEN THE BACKEND IS READY:
//   1. Confirm the real endpoint paths/payloads match the commented code.
//   2. Flip `USE_MOCK_DATA` below to `false`.
//   3. uploadDocument() will then send the actual file via FormData instead
//      of creating a blob URL — the real fileUrl returned by the backend
//      replaces the temporary blob: URL automatically.
//
// DocumentsPage.tsx NEVER needs to change — it only imports the exported
// function names and types from this file.
// ─────────────────────────────────────────────────────────────────────────────

import type { DocumentType } from "../constants/documentConstants";

// NOTE: import api from "../api/axios"; ← uncomment when switching to real API

const USE_MOCK_DATA = true;

// ─────────────────────────────────────────────────────────────
// Types matching (expected) backend DTOs
// ─────────────────────────────────────────────────────────────

export interface DocumentResponse {
  id: string;
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  documentType: DocumentType;
  projectId?: string;
  projectName?: string;
  description?: string;
  expiryDate?: string | null;
  uploadedBy: string;
  uploadedAt: string;
  fileUrl: string; // blob: URL in mock mode → real backend URL once live
}

export interface UploadDocumentRequest {
  file: File;
  documentType: DocumentType;
  projectId?: string;
  projectName?: string;
  description?: string;
  expiryDate?: string;
}

export interface DocumentFilterParams {
  search?: string;
  documentType?: DocumentType | "ALL";
  projectId?: string;
}

// ─────────────────────────────────────────────────────────────
// MOCK DATA STORE (in-memory, resets on page refresh)
// ─────────────────────────────────────────────────────────────

let mockDocuments: DocumentResponse[] = [
  {
    id: "d-001",
    fileName: "BIS-Certificate-ISO9001.pdf",
    fileSize: 482_000,
    mimeType: "application/pdf",
    documentType: "BIS_CERTIFICATE",
    projectId: "demo-project-1",
    projectName: "ISO - Ai automation product",
    description: "Original certificate copy",
    expiryDate: "2027-06-30",
    uploadedBy: "admin@standphill.com",
    uploadedAt: "2026-06-10T10:00:00.000Z",
    fileUrl: "",
  },
  {
    id: "d-002",
    fileName: "Factory-Inspection-Report.pdf",
    fileSize: 1_240_000,
    mimeType: "application/pdf",
    documentType: "FACTORY_INSPECTION_REPORT",
    projectId: "demo-project-1",
    projectName: "ISO - Ai automation product",
    uploadedBy: "engineer@standphill.com",
    uploadedAt: "2026-06-02T09:30:00.000Z",
    fileUrl: "",
  },
  {
    id: "d-003",
    fileName: "GST-Certificate.pdf",
    fileSize: 210_000,
    mimeType: "application/pdf",
    documentType: "GST_CERTIFICATE",
    expiryDate: "2026-08-15",
    uploadedBy: "admin@standphill.com",
    uploadedAt: "2026-05-20T12:00:00.000Z",
    fileUrl: "",
  },
];

const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms));
const genId = () => `d-${Math.random().toString(36).slice(2, 9)}`;

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// ─────────────────────────────────────────────────────────────
// GET /api/documents  →  fetch documents (optionally filtered)
// ─────────────────────────────────────────────────────────────
export const fetchDocuments = async (
  params: DocumentFilterParams = {}
): Promise<DocumentResponse[]> => {
  if (USE_MOCK_DATA) {
    await delay();
    let result = [...mockDocuments];

    if (params.search) {
      const q = params.search.toLowerCase();
      result = result.filter(
        (d) =>
          d.fileName.toLowerCase().includes(q) ||
          (d.projectName ?? "").toLowerCase().includes(q)
      );
    }
    if (params.documentType && params.documentType !== "ALL") {
      result = result.filter((d) => d.documentType === params.documentType);
    }
    if (params.projectId) {
      result = result.filter((d) => d.projectId === params.projectId);
    }

    return result.sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }

  // const res = await api.get<DocumentResponse[]>("/documents", { params });
  // return res.data;
  throw new Error("Real /api/documents endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// POST /api/documents  →  upload a document
// ─────────────────────────────────────────────────────────────
export const uploadDocument = async (
  data: UploadDocumentRequest
): Promise<DocumentResponse> => {
  if (USE_MOCK_DATA) {
    await delay(700); // a little longer, feels like a real upload

    const newDoc: DocumentResponse = {
      id: genId(),
      fileName: data.file.name,
      fileSize: data.file.size,
      mimeType: data.file.type || "application/octet-stream",
      documentType: data.documentType,
      projectId: data.projectId,
      projectName: data.projectName,
      description: data.description,
      expiryDate: data.expiryDate || null,
      uploadedBy: "admin@standphill.com", // TODO: pull from auth context once available
      uploadedAt: new Date().toISOString(),
      fileUrl: URL.createObjectURL(data.file), // real, working local preview/download link
    };

    mockDocuments = [newDoc, ...mockDocuments];
    return newDoc;
  }

  // const formData = new FormData();
  // formData.append("file", data.file);
  // formData.append("documentType", data.documentType);
  // if (data.projectId) formData.append("projectId", data.projectId);
  // if (data.description) formData.append("description", data.description);
  // if (data.expiryDate) formData.append("expiryDate", data.expiryDate);
  // const res = await api.post<DocumentResponse>("/documents", formData, {
  //   headers: { "Content-Type": "multipart/form-data" },
  // });
  // return res.data;
  throw new Error("Real POST /api/documents endpoint not implemented yet");
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/documents/{id}
// ─────────────────────────────────────────────────────────────
export const deleteDocument = async (id: string): Promise<void> => {
  if (USE_MOCK_DATA) {
    await delay();
    const doc = mockDocuments.find((d) => d.id === id);
    if (doc?.fileUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(doc.fileUrl); // free the browser memory
    }
    mockDocuments = mockDocuments.filter((d) => d.id !== id);
    return;
  }

  // await api.delete(`/documents/${id}`);
  throw new Error("Real DELETE /api/documents/{id} endpoint not implemented yet");
};