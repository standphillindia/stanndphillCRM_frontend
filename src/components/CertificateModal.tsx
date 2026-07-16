// src/components/CertificateModal.tsx
// Modal to collect certificate details when LICENSE_GRANTED is reached

import { useState } from "react";
import { X } from "lucide-react";
import { useToast } from "../context/ToastContext";
import {
  createCertification,
  type CertificationResponse,
  type CreateCertificationRequest,
} from "../services/certificationService";
import type { ProjectResponse } from "../services/projectService";

interface CertificateModalProps {
  project: ProjectResponse;
  onConfirm: (certificate: CertificationResponse) => void;
  onClose: () => void;
  loading: boolean;
}

export default function CertificateModal({
  project,
  onConfirm,
  onClose,
  loading,
}: CertificateModalProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    certificateNo: "",
    issueDate: new Date().toISOString().split("T")[0],
    validityYears: 1,
    remarks: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "validityYears" ? parseInt(value, 10) : value,
    }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.certificateNo.trim()) {
      setError("Certificate number is required");
      return false;
    }
    if (!formData.issueDate.trim()) {
      setError("Issue date is required");
      return false;
    }
    if (formData.validityYears < 1) {
      setError("Validity years must be at least 1");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateCertificationRequest = {
        projectId: project.id,
        certificateNo: formData.certificateNo.trim(),
        issueDate: formData.issueDate,
        validityYears: formData.validityYears,
        remarks: formData.remarks.trim() || undefined,
      };

      const response = await createCertification(payload);

      addToast({
        title: "Certificate Created",
        message: `Certificate ${response.certificateNo} created successfully`,
        type: "success",
        duration: 5000,
      });

      onConfirm(response);
    } catch (err: any) {
      const errMsg =
        err?.response?.data?.message ?? "Failed to create certificate";
      setError(errMsg);
      addToast({
        title: "Error",
        message: errMsg,
        type: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.certificateNo.trim() &&
    formData.issueDate &&
    formData.validityYears >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Create Certificate</h2>
          <button
            onClick={onClose}
            disabled={loading || isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Project Context (Read-only) */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500 font-medium uppercase mb-2">
            Project Information
          </p>
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">
              {project.projectName}
            </p>
            <p className="text-xs text-gray-600">
              {project.certificationType}
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Certificate Number */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Certificate Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            name="certificateNo"
            placeholder="e.g., BIS-2024-001"
            value={formData.certificateNo}
            onChange={handleInputChange}
            disabled={loading || isSubmitting}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Issue Date */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Issue Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="issueDate"
            value={formData.issueDate}
            onChange={handleInputChange}
            disabled={loading || isSubmitting}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Validity Years */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Validity (Years) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            name="validityYears"
            min="1"
            max="20"
            value={formData.validityYears}
            onChange={handleInputChange}
            disabled={loading || isSubmitting}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Remarks */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Remarks (Optional)
          </label>
          <textarea
            name="remarks"
            placeholder="Any additional notes…"
            value={formData.remarks}
            onChange={handleInputChange}
            disabled={loading || isSubmitting}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading || isSubmitting}
            className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || isSubmitting || !isFormValid}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-green-700"
          >
            {isSubmitting ? "Creating…" : "Create Certificate"}
          </button>
        </div>
      </div>
    </div>
  );
}