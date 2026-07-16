// src/services/invoiceService.ts

import api from "../api/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

// ⚠️ DEPRECATED / BROKEN — the Deal module has been removed entirely from
// the backend. Everything below this point (CreateInvoiceRequest,
// FinanceDealResponse, createProformaInvoice, createTaxInvoice,
// updateInvoice, markInvoiceAsSent — wait, markInvoiceAsSent still works,
// see note there — recordPaymentReceived, getPendingFinanceDeals,
// createTaxInvoiceWithDetails, getInvoiceTemplate, updateDealStatus) calls
// backend endpoints that no longer exist (they 404 now). Do not use these
// for new work — use the "PROJECT INVOICING & PAYMENTS" section near the
// bottom of this file instead (createProjectInvoice, getInvoicesByProject,
// getProjectInvoiceSummary, getProjectInvoicesWithPayment), which mirrors
// the AMC invoicing functions and is what the new Payments -> List ->
// Project page uses. The components that used to import these (Dealspage,
// DealFinanceWorkflow, ProformaInvoiceModal, TaxInvoiceModel,
// ProjectCreationModel, dealService, PaymentList, PaymentDetails) have all
// been deleted — nothing in the app imports the functions below anymore,
// they're left in place only in case something external still expects
// this file to export them.

export interface CreateInvoiceRequest {
  dealId: string;
  invoiceType: "PROFORMA" | "TAX";
  referenceType: string;
  clientName: string;
  clientEmail: string;
  clientGst: string;
  billingAddress: string;
  amount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  remarks?: string;
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
  status: "DRAFT" | "SENT" | "PAID";
  clientName: string;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
  pdfPath?: string;
  sentDate?: string;
}

export interface FinanceDealResponse {
  id: string;
  dealName: string;
  amount: number;
  financeStatus: "PENDING_PI" | "PI_SENT" | "PAYMENT_RECEIVED" | "TAX_INVOICE_GENERATED";
}



// ── API Calls ─────────────────────────────────────────────────────────────────

/**
 * Create Proforma Invoice (PI)
 */
export const createProformaInvoice = async (req: CreateInvoiceRequest): Promise<InvoiceResponse> => {
  const response = await api.post<InvoiceResponse>("/finance/invoices", {
    ...req,
    invoiceType: "PROFORMA",
    referenceType: "DEAL",
  });
  return response.data;
};

/**
 * Create Tax Invoice (TI) after payment received
 */
export const createTaxInvoice = async (dealId: string): Promise<InvoiceResponse> => {
  const response = await api.post<InvoiceResponse>(
    `/finance/invoices/deals/${dealId}/generate-tax-invoice`
  );
  return response.data;
};

/**
 * Update/Edit Invoice (while DRAFT)
 */
export const updateInvoice = async (
  invoiceId: string,
  req: CreateInvoiceRequest
): Promise<InvoiceResponse> => {
  const response = await api.put<InvoiceResponse>(`/finance/invoices/${invoiceId}`, {
    ...req,
    dealId: undefined, // Remove dealId for update
  });
  return response.data;
};

/**
 * Mark Invoice as SENT
 */
export const markInvoiceAsSent = async (invoiceId: string): Promise<InvoiceResponse> => {
  const response = await api.post<InvoiceResponse>(
    `/finance/invoices/${invoiceId}/mark-sent`
  );
  return response.data;
};

/**
 * Record Payment Received
 */
export const recordPaymentReceived = async (dealId: string): Promise<FinanceDealResponse> => {
  const response = await api.post<FinanceDealResponse>(
    `/finance/invoices/deals/${dealId}/payment-received`
  );
  return response.data;
};

/**
 * Get Invoice by ID
 */
export const getInvoiceById = async (invoiceId: string): Promise<InvoiceResponse> => {
  const response = await api.get<InvoiceResponse>(`/finance/invoices/${invoiceId}`);
  return response.data;
};

/**
 * Get all invoices
 */
export const getAllInvoices = async (): Promise<InvoiceResponse[]> => {
  const response = await api.get<InvoiceResponse[]>("/finance/invoices");
  return response.data;
};

/**
 * Download Invoice PDF
 */
export const downloadInvoicePdf = async (invoiceId: string): Promise<Blob> => {
  const response = await api.get(`/finance/invoices/${invoiceId}/download`, {
    responseType: "blob",
  });
  return response.data;
};

/**
 * Get Pending Finance Deals (need PI)
 */
export const getPendingFinanceDeals = async (): Promise<FinanceDealResponse[]> => {
  const response = await api.get<FinanceDealResponse[]>("/finance/invoices/deals/pending");
  return response.data;
};

/**
 * Helper: Calculate tax (18% IGST)
 */
export const calculateTax = (amount: number, taxRate: number = 18): number => {
  return parseFloat(((amount * taxRate) / 100).toFixed(2));
};

/**
 * Helper: Calculate total
 */
export const calculateTotal = (taxableAmount: number, taxAmount: number): number => {
  return parseFloat((taxableAmount + taxAmount).toFixed(2));
};

// ==========================================
// ADD THESE FUNCTIONS TO YOUR invoiceService.ts
// ==========================================


// Create Tax Invoice with detailed buyer information
export const createTaxInvoiceWithDetails = async (dealId: string, payload: {
  buyerName: string;
  buyerGST: string;
  buyerAddress: string;
  service: string;
  hsn: string;
  taxableAmount: number;
  igstRate: number;
  notes?: string;
}) => {
  try {
    const response = await api.post(
      `/finance/invoices/deals/${dealId}/tax-invoice`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error('Error creating tax invoice:', error);
    throw error;
  }
};

// Generate Tax Invoice PDF
export const generateTIPDF = async (invoiceId: string) => {
  try {
    const response = await api.get(
      `/finance/invoices/${invoiceId}/generate-pdf`,
      { 
        responseType: 'blob'
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

// Get Invoice Template (optional - for prefilling data)
export const getInvoiceTemplate = async (dealId: string) => {
  try {
    const response = await api.get(
      `/finance/invoices/template/${dealId}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching invoice template:', error);
    throw error;
  }
};

// Update Deal Status to PROJECT_CREATED
export const updateDealStatus = async (dealId: string, status: string) => {
  try {
    const response = await api.patch(
      `/deals/${dealId}/status`,
      { financeStatus: status }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating deal status:', error);
    throw error;
  }
};

// ==========================================
// AMC INVOICING & PAYMENTS — added for AMC Leads/Payments module
// These are net-new endpoints/types (referenceType: "AMC") and do not
// touch any of the existing Deal-based invoice functions above.
// ==========================================

export interface InvoiceLineItemRequest {
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceItemResponse {
  id: string;
  description: string;
  sacCode: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Full detail shape returned by the AMC create/update/getById endpoints
// (matches backend InvoiceDetailsResponse). Superset of InvoiceResponse.
export interface InvoiceDetailsResponse {
  id: string;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
  status: "DRAFT" | "SENT" | "PAID";
  referenceType: "PROJECT" | "AMC";
  projectId?: string;
  amcId?: string;
  sourcePiId?: string;
  clientName: string;
  clientEmail: string;
  clientGst: string;
  billingAddress: string;
  clientContactPerson?: string;
  clientPhone?: string;
  placeOfSupply?: string;
  paymentTerms?: string;
  validityDays?: number;
  amount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  dueDate: string;
  sentDate?: string;
  remarks?: string;
  pdfAvailable: boolean;
  items: InvoiceItemResponse[];
}

export interface AmcInvoiceSummaryResponse {
  amcId: string;
  totalProforma: number;
  totalTax: number;
  draftCount: number;
  sentCount: number;
  totalInvoicedAmount: number;
}

// A PI or TI row combined with its payment tracking (Total/Received/Pending/Status)
export interface AmcInvoicePaymentRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
  invoiceStatus: "DRAFT" | "SENT";
  paymentId?: string;
  totalAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  dueDate?: string;
  sourcePiId?: string;
  sourcePiNumber?: string;
}

/**
 * Create a PI or TI directly against an AMC (not a Deal). AMC invoicing
 * doesn't gate through PI_SENT -> PAYMENT_RECEIVED like Deals do — both PI
 * and TI can be created independently since AMC billing repeats over the
 * contract's lifetime (annual/renewal cycles).
 */
export const createAmcInvoice = async (
  amcId: string,
  invoiceType: "PROFORMA" | "TAX",
  req: {
    clientName: string;
    clientEmail: string;
    clientGst: string;
    billingAddress: string;
    amount: number;
    taxableAmount: number;
    taxAmount: number;
    totalAmount: number;
    issueDate: string;
    dueDate: string;
    remarks?: string;
    items?: InvoiceLineItemRequest[];
    // Only meaningful when invoiceType="TAX" — link this TI to an
    // existing PI right at creation, so its payment status mirrors that
    // PI's instead of showing dashes.
    sourcePiId?: string;
  }
): Promise<InvoiceDetailsResponse> => {
  const response = await api.post<InvoiceDetailsResponse>("/finance/invoices", {
    ...req,
    amcId,
    invoiceType,
    referenceType: "AMC",
  });
  return response.data;
};

/**
 * Retroactively link an already-created standalone TI to a PI — for TIs
 * made via "New TI (standalone, no linked PI)" that should now show
 * payment tracking (mirrored from the PI).
 */
export const linkTiToPi = async (
  tiId: string,
  piId: string
): Promise<InvoiceDetailsResponse> => {
  const response = await api.patch<InvoiceDetailsResponse>(
    `/finance/invoices/${tiId}/link-pi/${piId}`
  );
  return response.data;
};

/**
 * Get full invoice details by ID (client details + line items) — used to
 * reopen/preview/edit an AMC PI or TI. Kept separate from getInvoiceById
 * above so the existing Deal-invoice flow (typed as InvoiceResponse) is
 * left completely untouched.
 */
export const getInvoiceDetailsById = async (invoiceId: string): Promise<InvoiceDetailsResponse> => {
  const response = await api.get<InvoiceDetailsResponse>(`/finance/invoices/${invoiceId}`);
  return response.data;
};

/**
 * Update an AMC invoice while it's still editable — partial update, PATCH.
 * Separate from the existing `updateInvoice` (full-object PUT) so nothing
 * in the current Deal PI/TI edit flow changes.
 */
export const updateAmcInvoiceDetails = async (
  invoiceId: string,
  req: {
    clientName?: string;
    clientGst?: string;
    billingAddress?: string;
    remarks?: string;
    taxableAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    items?: InvoiceLineItemRequest[];
  }
): Promise<InvoiceDetailsResponse> => {
  const response = await api.patch<InvoiceDetailsResponse>(
    `/finance/invoices/${invoiceId}`,
    req
  );
  return response.data;
};

/**
 * Search invoices by client name or invoice number — powers the
 * "find any client's PI/TI from anywhere in Payments" workflow.
 */
export const searchInvoices = async (query: string): Promise<InvoiceResponse[]> => {
  const response = await api.get<InvoiceResponse[]>("/finance/invoices/search", {
    params: { query },
  });
  return response.data;
};

/**
 * All PI + TI issued for a specific AMC.
 */
export const getInvoicesByAmc = async (amcId: string): Promise<InvoiceResponse[]> => {
  const response = await api.get<InvoiceResponse[]>(`/finance/invoices/amc/${amcId}`);
  return response.data;
};

/**
 * Summary counts (PI issued, TI issued, draft/sent) for an AMC — powers
 * the AMC list page inside Payments.
 */
export const getAmcInvoiceSummary = async (amcId: string): Promise<AmcInvoiceSummaryResponse> => {
  const response = await api.get<AmcInvoiceSummaryResponse>(
    `/finance/invoices/amc/${amcId}/summary`
  );
  return response.data;
};

/**
 * PI + TI rows for an AMC combined with payment tracking
 * (Total/Received/Pending/Status) — powers the AMC payment table.
 */
export const getAmcInvoicesWithPayment = async (amcId: string): Promise<AmcInvoicePaymentRow[]> => {
  const response = await api.get<AmcInvoicePaymentRow[]>(`/finance/invoices/amc/${amcId}/with-payment`);
  return response.data;
};

/**
 * Generate a TI from a PI, once that PI's payment is fully received. The TI
 * is linked back to the PI via sourcePiId; client details and line items
 * are copied over automatically.
 */
export const generateTiFromPi = async (piInvoiceId: string): Promise<InvoiceDetailsResponse> => {
  const response = await api.post<InvoiceDetailsResponse>(`/finance/invoices/${piInvoiceId}/generate-ti`);
  return response.data;
};
// ==========================================
// PROJECT INVOICING & PAYMENTS — direct replacement for the old Deal-based
// finance pipeline (createProformaInvoice/createTaxInvoice/
// recordPaymentReceived/updateDealStatus above — those call backend
// endpoints that no longer exist now that the Deal module has been
// removed entirely). A Lead going WON now creates a Project directly
// (DRAFT stage), and PI/TI/payment tracking works exactly like AMC does,
// just scoped to a Project instead of an AMC contract.
// ==========================================

export interface ProjectInvoiceSummaryResponse {
  projectId: string;
  totalProforma: number;
  totalTax: number;
  draftCount: number;
  sentCount: number;
  totalInvoicedAmount: number;
}

// Same shape as AmcInvoicePaymentRow — a PI or TI row combined with its
// payment tracking (Total/Received/Pending/Status).
export interface ProjectInvoicePaymentRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "PROFORMA" | "TAX";
  invoiceStatus: "DRAFT" | "SENT";
  paymentId?: string;
  totalAmount: number;
  paidAmount?: number;
  dueAmount?: number;
  paymentStatus?: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  dueDate?: string;
  sourcePiId?: string;
  sourcePiNumber?: string;
}

/**
 * Create a PI or TI directly against a Project. Same shape/behaviour as
 * createAmcInvoice — both PI and TI can be created independently (no
 * PI_SENT -> PAYMENT_RECEIVED gating like the old Deal flow had).
 */
export const createProjectInvoice = async (
  projectId: string,
  invoiceType: "PROFORMA" | "TAX",
  req: {
    clientName: string;
    clientEmail: string;
    clientGst: string;
    billingAddress: string;
    amount: number;
    taxableAmount: number;
    taxAmount: number;
    totalAmount: number;
    issueDate: string;
    dueDate: string;
    remarks?: string;
    items?: InvoiceLineItemRequest[];
    // Only meaningful when invoiceType="TAX" — link this TI to an
    // existing PI right at creation.
    sourcePiId?: string;
  }
): Promise<InvoiceDetailsResponse> => {
  const response = await api.post<InvoiceDetailsResponse>("/finance/invoices", {
    ...req,
    projectId,
    invoiceType,
    referenceType: "PROJECT",
  });
  return response.data;
};

/**
 * All PI + TI issued for a specific Project.
 */
export const getInvoicesByProject = async (projectId: string): Promise<InvoiceResponse[]> => {
  const response = await api.get<InvoiceResponse[]>(`/finance/invoices/project/${projectId}`);
  return response.data;
};

/**
 * Summary counts (PI issued, TI issued, draft/sent) for a Project — powers
 * the Project list page inside Payments.
 */
export const getProjectInvoiceSummary = async (projectId: string): Promise<ProjectInvoiceSummaryResponse> => {
  const response = await api.get<ProjectInvoiceSummaryResponse>(
    `/finance/invoices/project/${projectId}/summary`
  );
  return response.data;
};

/**
 * PI + TI rows for a Project combined with payment tracking
 * (Total/Received/Pending/Status) — powers the Project payment table.
 */
export const getProjectInvoicesWithPayment = async (projectId: string): Promise<ProjectInvoicePaymentRow[]> => {
  const response = await api.get<ProjectInvoicePaymentRow[]>(`/finance/invoices/project/${projectId}/with-payment`);
  return response.data;
};
