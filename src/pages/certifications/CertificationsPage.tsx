// src/pages/certifications/CertificationsPage.tsx
// Full implementation of certifications registry with filters and status tracking

import { useEffect, useState } from "react";
import { useToast } from "../../context/ToastContext";
import {
  fetchCertifications,
  renewCertification,
  getCertification,
  type CertificationResponse,
  type FetchCertificationsParams,
} from "../../services/certificationService";
import { AlertCircle, CheckCircle2, Clock, Search, RefreshCw } from "lucide-react";

type StatusFilter = "ALL" | "VALID" | "EXPIRING_SOON" | "EXPIRED";

export default function CertificationsPage() {
  const { addToast } = useToast();
  const [certifications, setCertifications] = useState<CertificationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCert, setSelectedCert] = useState<CertificationResponse | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [pageNum, setPageNum] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [renewing, setRenewing] = useState<string | null>(null);

  // Load certifications
  const loadCertifications = async (page: number = 0) => {
    try {
      setLoading(true);
      const params: FetchCertificationsParams = {
        page,
        size: 10,
        ...(searchQuery.trim() && { search: searchQuery.trim() }),
        ...(statusFilter !== "ALL" && { status: statusFilter }),
        sortBy: "createdAt",
        sortDir: "desc",
      };

      const result = await fetchCertifications(params);
      setCertifications(result.content);
      setTotalPages(result.totalPages);
      setPageNum(page);
    } catch (error: any) {
      addToast({
        title: "Error",
        message: error?.response?.data?.message ?? "Failed to load certifications",
        type: "error",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadCertifications(0);
  }, []);

  // Reload when filters change
  useEffect(() => {
    loadCertifications(0);
  }, [searchQuery, statusFilter]);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "VALID":
        return "bg-green-50 text-green-700 border border-green-200";
      case "EXPIRING_SOON":
        return "bg-yellow-50 text-yellow-700 border border-yellow-200";
      case "EXPIRED":
        return "bg-red-50 text-red-700 border border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "VALID":
        return <CheckCircle2 className="w-4 h-4" />;
      case "EXPIRING_SOON":
        return <Clock className="w-4 h-4" />;
      case "EXPIRED":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Calculate expiry date display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Days until expiry
  const daysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Handle renewal
  const handleRenew = async (certId: string) => {
    if (window.confirm("Are you sure you want to renew this certificate?")) {
      try {
        setRenewing(certId);
        // TODO: Implement renewal date picker modal
        // For now, renew for 3 more years
        await renewCertification(certId, {
          newIssueDate: new Date().toISOString().split("T")[0],
          newValidityYears: 3,
          remarks: "Renewed",
        });
        addToast({
          title: "Certificate Renewed",
          message: "Certificate has been renewed successfully",
          type: "success",
          duration: 5000,
        });
        await loadCertifications(pageNum);
        setShowDetails(false);
      } catch (error: any) {
        addToast({
          title: "Error",
          message: error?.response?.data?.message ?? "Failed to renew certificate",
          type: "error",
          duration: 5000,
        });
      } finally {
        setRenewing(null);
      }
    }
  };

  // View certificate details
  const viewDetails = async (cert: CertificationResponse) => {
    try {
      const fullCert = await getCertification(cert.id);
      setSelectedCert(fullCert);
      setShowDetails(true);
    } catch (error: any) {
      addToast({
        title: "Error",
        message: "Failed to load certificate details",
        type: "error",
        duration: 5000,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Certifications</h1>
        <p className="text-gray-500 mt-1">Track and manage all certifications and compliance records</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by certificate number…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">All Status</option>
            <option value="VALID">Valid</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => loadCertifications(0)}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Certifications Table */}
      {loading && !certifications.length ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Loading certifications…</p>
        </div>
      ) : certifications.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
            <AlertCircle className="w-6 h-6 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No certifications found</h3>
          <p className="text-sm text-gray-500">
            {searchQuery || statusFilter !== "ALL"
              ? "Try adjusting your filters"
              : "Certifications will appear here once projects reach LICENSE_GRANTED stage"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Certificate
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Issue Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Expiry
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 text-xs uppercase tracking-wide">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((cert) => {
                  const daysLeft = daysUntilExpiry(cert.expiryDate);
                  return (
                    <tr key={cert.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{cert.certificateNo}</p>
                        <p className="text-xs text-gray-500">{cert.projectName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{cert.companyName}</td>
                      <td className="px-4 py-3 text-gray-700">{cert.certificationType}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(cert.issueDate)}</td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900">{formatDate(cert.expiryDate)}</p>
                        <p className="text-xs text-gray-500">
                          {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(cert.status)}`}>
                          {getStatusIcon(cert.status)}
                          {cert.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => viewDetails(cert)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                          >
                            View
                          </button>
                          {cert.status !== "EXPIRED" && (
                            <button
                              onClick={() => handleRenew(cert.id)}
                              disabled={renewing === cert.id}
                              className="text-green-600 hover:text-green-700 text-sm font-medium disabled:text-gray-400"
                            >
                              {renewing === cert.id ? "Renewing…" : "Renew"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                Page {pageNum + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadCertifications(pageNum - 1)}
                  disabled={pageNum === 0 || loading}
                  className="px-3 py-1 border rounded text-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => loadCertifications(pageNum + 1)}
                  disabled={pageNum >= totalPages - 1 || loading}
                  className="px-3 py-1 border rounded text-sm hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Certificate Details</h2>
                <p className="text-sm text-gray-500 mt-1">{selectedCert.certificateNo}</p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Certificate Number</p>
                <p className="text-sm font-semibold text-gray-900">{selectedCert.certificateNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Status</p>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedCert.status)}`}>
                  {getStatusIcon(selectedCert.status)}
                  {selectedCert.status.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Company Name</p>
                <p className="text-sm font-semibold text-gray-900">{selectedCert.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Certification Type</p>
                <p className="text-sm font-semibold text-gray-900">{selectedCert.certificationType}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Project Name</p>
                <p className="text-sm font-semibold text-gray-900">{selectedCert.projectName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Issue Date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(selectedCert.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Expiry Date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(selectedCert.expiryDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Reminder Date</p>
                <p className="text-sm font-semibold text-gray-900">{formatDate(selectedCert.reminderDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Validity Years</p>
                <p className="text-sm font-semibold text-gray-900">{selectedCert.validityYears}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Validity Period</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDate(selectedCert.issueDate)} to {formatDate(selectedCert.expiryDate)}
                </p>
              </div>
            </div>

            {/* Remarks */}
            {selectedCert.remarks && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-500 font-medium uppercase mb-2">Remarks</p>
                <p className="text-sm text-gray-700">{selectedCert.remarks}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
              {selectedCert.status !== "EXPIRED" && (
                <button
                  onClick={() => {
                    setShowDetails(false);
                    handleRenew(selectedCert.id);
                  }}
                  disabled={renewing === selectedCert.id}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-400"
                >
                  {renewing === selectedCert.id ? "Renewing…" : "Renew Certificate"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}