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
  // Nov 2026 — who entered / last corrected it (empty on older entries)
  recordedByName?: string | null;
  recordedAt?: string | null;
  editedByName?: string | null;
  editedAt?: string | null;
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

export interface PaymentResponse {
  id: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  status: string;
  projectId: string;
}

export interface AddPaymentTransactionRequest {
  amount: number;
  paidDate: string;
  paidBy: string;
  paymentMode: string;
  referenceNo: string;
}

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}