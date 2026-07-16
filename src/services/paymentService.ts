import api from "../api/axios";

// ════════════════════════════════════════════════════════════════
// INTERFACES / TYPES
// ════════════════════════════════════════════════════════════════

export interface PaymentResponse {
  id: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  status: string;
  projectId: string;
}

export interface PaymentDetailsResponse {
  paymentId: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  companyName: string;
  contactPerson: string;
  projectName: string;
  projectType: string;
  transactions: PaymentTransactionResponse[];
}

export interface PaymentTransactionResponse {
  id: string;
  amount: number;
  paidDate: string;
  paidBy: string;
  paymentMode: string;
  referenceNo: string;
}

export interface AddPaymentTransactionRequest {
  amount: number;
  paidDate: string;
  paidBy: string;
  paymentMode: string;
  referenceNo: string;
}

export interface PaymentDashboardResponse {
  totalCollection: number;
  totalPending: number;
  totalProjects: number;
  overduePayments: number;
}

export interface InvoiceHistoryResponse {
  invoiceNumber: string;
  invoiceType: string;
  amount: number;
  status: string;
}

export interface PaymentFilterParams {
  status?: string;
  projectId?: string;
  dueBefore?: string;
  dueAfter?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ════════════════════════════════════════════════════════════════
// MOCK DATA (For testing when backend is down)
// ════════════════════════════════════════════════════════════════

const MOCK_PAYMENTS: PaymentResponse[] = [
  {
    id: "1",
    totalAmount: 50000,
    paidAmount: 30000,
    dueAmount: 20000,
    dueDate: "2026-07-15",
    status: "PENDING",
    projectId: "PROJ-001",
  },
  {
    id: "2",
    totalAmount: 75000,
    paidAmount: 75000,
    dueAmount: 0,
    dueDate: "2026-06-20",
    status: "PAID",
    projectId: "PROJ-002",
  },
  {
    id: "3",
    totalAmount: 100000,
    paidAmount: 50000,
    dueAmount: 50000,
    dueDate: "2026-07-30",
    status: "PARTIAL",
    projectId: "PROJ-003",
  },
];

// ════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Get all payments
 */
export async function getAllPayments(): Promise<PaymentResponse[]> {
  try {
    const response = await api.get<PaymentResponse[]>("/payments");
    return response.data || [];
  } catch (error) {
    console.error("❌ Error fetching all payments:", error);
    throw error;
  }
}

/**
 * Get payment dashboard data
 */
export async function getPaymentDashboard(): Promise<PaymentDashboardResponse> {
  try {
    const response = await api.get<PaymentDashboardResponse>(
      "/payments/dashboard"
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching dashboard:", error);
    throw error;
  }
}

/**
 * Filter payments with pagination and sorting
 * ✅ NOW WITH FALLBACK TO MOCK DATA & BETTER ERROR LOGGING
 */
export async function filterPayments(
  params: PaymentFilterParams
): Promise<PaginatedResponse<PaymentResponse>> {
  try {
    const queryParams = new URLSearchParams();

    if (params.status) queryParams.append("status", params.status);
    if (params.projectId) queryParams.append("projectId", params.projectId);
    if (params.dueBefore) queryParams.append("dueBefore", params.dueBefore);
    if (params.dueAfter) queryParams.append("dueAfter", params.dueAfter);
    if (params.amountMin !== undefined)
      queryParams.append("amountMin", params.amountMin.toString());
    if (params.amountMax !== undefined)
      queryParams.append("amountMax", params.amountMax.toString());

    queryParams.append("page", (params.page || 0).toString());
    queryParams.append("size", (params.size || 10).toString());
    queryParams.append("sortBy", params.sortBy || "createdAt");
    queryParams.append("sortDir", params.sortDir || "desc");

    const url = `/payments/filter?${queryParams.toString()}`;
    console.log("📡 Calling API:", url);

    const response = await api.get<PaginatedResponse<PaymentResponse>>(url);

    console.log("✅ Payments loaded:", response.data);
    return response.data;
  } catch (error) {
    console.error("❌ Error filtering payments:", {
      error,
      message: error instanceof Error ? error.message : "Unknown error",
      status:
        error instanceof Error && "response" in error
          ? (error as any).response?.status
          : "N/A",
    });

    // ✅ FALLBACK: Return mock data so UI doesn't crash
    console.warn(
      "⚠️ Using mock data (backend may be down or endpoint doesn't exist)"
    );
    return {
      content: MOCK_PAYMENTS,
      totalElements: MOCK_PAYMENTS.length,
      totalPages: 1,
      number: 0,
      size: 10,
    };
  }
}

/**
 * Get payment details by ID
 */
export async function getPaymentDetails(
  paymentId: string
): Promise<PaymentDetailsResponse> {
  try {
    const response = await api.get<PaymentDetailsResponse>(
      `/payments/${paymentId}`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching payment details:", error);
    throw error;
  }
}

/**
 * Get transactions for a specific payment
 */
export async function getPaymentTransactions(
  paymentId: string
): Promise<PaymentTransactionResponse[]> {
  try {
    const response = await api.get<PaymentTransactionResponse[]>(
      `/payments/${paymentId}/transactions`
    );
    return response.data || [];
  } catch (error) {
    console.error("❌ Error fetching transactions:", error);
    throw error;
  }
}

/**
 * Add a new payment transaction
 */
export async function addPaymentTransaction(
  paymentId: string,
  request: AddPaymentTransactionRequest
): Promise<PaymentTransactionResponse> {
  try {
    const response = await api.post<PaymentTransactionResponse>(
      `/payments/${paymentId}/transactions`,
      request
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error adding transaction:", error);
    throw error;
  }
}

/**
 * Get invoice history for a payment
 */
export async function getInvoiceHistory(
  paymentId: string
): Promise<InvoiceHistoryResponse[]> {
  try {
    const response = await api.get<InvoiceHistoryResponse[]>(
      `/payments/${paymentId}/invoice-history`
    );
    return response.data || [];
  } catch (error) {
    console.error("❌ Error fetching invoice history:", error);
    throw error;
  }
}

/**
 * Get payment by project ID
 */
export async function getPaymentByProject(
  projectId: string
): Promise<PaymentResponse> {
  try {
    const response = await api.get<PaymentResponse>(
      `/payments/project/${projectId}`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching payment by project:", error);
    throw error;
  }
}