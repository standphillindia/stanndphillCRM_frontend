// src/services/quotationService.ts
//
// Talks to /api/finance/quotations. Mounted under /finance rather than a
// top-level /quotations path because ModuleAccessFilter already maps
// /api/finance to the PAYMENTS module, so these endpoints inherit the
// existing role permissions with no RBAC changes.

import api from "../api/axios";

// ── Types ────────────────────────────────────────────────────────────

export interface FunctionalScopeRow {
  stepLabel: string;
  description: string;
  /** Blank means "same as the row above" — the document merges the run. */
  timeDuration: string;
}

export interface PaymentTermRow {
  label: string;
  value: string;
}

/** Part 3 "A. Product Sample required" row (BEE and other lab-tested schemes). */
export interface SampleRequirementRow {
  productName: string;
  quantity: string;
}

export interface QuotationLineItemRequest {
  /**
   * Which priced table this row belongs to, counting from zero.
   *
   * Grouping is by this, not by the heading. Two tables can share a
   * heading — or carry none — and grouping on the text merged them.
   */
  sectionIndex?: number;
  /**
   * Row and column position inside the table. Same reason as sectionIndex:
   * unlabelled columns used to collapse into one because they were matched
   * by label, and only the first amount printed.
   */
  rowIndex?: number;
  columnIndex?: number;
  /**
   * Shown instead of the amount — "As per the company", "At actuals".
   * A text cell is saved with amountInr 0, so it never counts in the total.
   */
  amountText?: string;
  /** Heading printed above that table. Display only. */
  sectionTitle?: string;
  /**
   * Which priced column inside that table. Rows sharing a sectionTitle and
   * category are pivoted into one row at render time, one column per label.
   */
  columnLabel?: string;
  category?: string;
  description?: string;
  amountInr?: number;
  amountUsd?: number;
  remarks?: string;
  isGovernmentFee?: boolean;
}

export interface QuotationLineItemResponse extends QuotationLineItemRequest {
  id: string;
  sortOrder: number;
}

export interface CertificationTypeOption {
  value: string;
  label: string;
  offerPrefix: string;
}

export type QuotationEntryType = "UPLOADED" | "RECEIVED";

/** Row shape on the list page — no content blocks, they aren't shown there. */
export interface QuotationResponse {
  id: string;
  offerNumber: string;
  offerDate: string;
  validUntil: string;
  certificationType: string;
  certificationTypeLabel: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  clientCompany?: string;
  kindAttention?: string;
  totalInr: number;
  expired: boolean;
  leadId?: string;
  independentProjectId?: string;
  convertedInvoiceId?: string;
  /** AMC lead it was raised for (AMC Leads page), if any. */
  amcLeadId?: string;
  // ── Uploaded / received / revised ──
  /** Absent = made in the CRM. "UPLOADED" = our quotation made outside the
   *  CRM (file only). "RECEIVED" = a quotation sent to us (client / vendor). */
  entryType?: QuotationEntryType | null;
  /** Revised quotation: the original it revises, and its number (R1, R2 …). */
  revisionOfId?: string | null;
  revisionNo?: number | null;
  /** Attached file (uploaded / received quotations). */
  fileName?: string | null;
  fileContentType?: string | null;
  fileSize?: number | null;
}

/** Everything the preview/PDF renderer and the duplicate flow need. */
export interface QuotationDetailsResponse {
  id: string;
  offerNumber: string;
  offerDate: string;
  validUntil: string;
  certificationType: string;
  certificationTypeLabel: string;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  expired: boolean;

  leadId?: string;
  independentProjectId?: string;

  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientMobile?: string;
  kindAttention?: string;

  introNote?: string;
  introParagraph?: string;
  projectDescription?: string;
  functionalScope?: FunctionalScopeRow[];
  totalTimeline?: string;
  basicAspects?: string[];
  basicRequirements?: string[];
  basicRequirementsNote?: string;
  sampleRequirements?: SampleRequirementRow[];
  sampleRemark?: string;
  sampleGuidelines?: string[];
  workScope?: string[];
  terms?: string[];
  paymentRatio?: PaymentTermRow[];
  showCurrencyColumn?: boolean;
  closingNote?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  remarks?: string;

  lineItems: QuotationLineItemResponse[];
  totalInr: number;
  totalUsd: number;

  convertedInvoiceId?: string;
  /** AMC lead it was raised for (AMC Leads page), if any. */
  amcLeadId?: string;
  // ── Uploaded / received / revised ──
  /** Absent = made in the CRM. "UPLOADED" = our quotation made outside the
   *  CRM (file only). "RECEIVED" = a quotation sent to us (client / vendor). */
  entryType?: QuotationEntryType | null;
  /** Revised quotation: the original it revises, and its number (R1, R2 …). */
  revisionOfId?: string | null;
  revisionNo?: number | null;
  /** Attached file (uploaded / received quotations). */
  fileName?: string | null;
  fileContentType?: string | null;
  fileSize?: number | null;
}

export interface CreateQuotationRequest {
  certificationType: string;
  /** Blank to auto-generate the next number for this prefix. */
  offerNumber?: string;
  offerDate?: string;
  validUntil?: string;

  leadId?: string;
  independentProjectId?: string;

  clientName?: string;
  clientCompany?: string;
  clientEmail?: string;
  clientMobile?: string;
  kindAttention: string;

  introNote?: string;
  introParagraph?: string;
  projectDescription?: string;
  functionalScope?: FunctionalScopeRow[];
  totalTimeline?: string;
  basicAspects?: string[];
  basicRequirements?: string[];
  basicRequirementsNote?: string;
  sampleRequirements?: SampleRequirementRow[];
  sampleRemark?: string;
  sampleGuidelines?: string[];
  workScope?: string[];
  terms?: string[];
  paymentRatio?: PaymentTermRow[];
  showCurrencyColumn?: boolean;
  closingNote?: string;
  signatoryName?: string;
  signatoryTitle?: string;
  remarks?: string;

  lineItems?: QuotationLineItemRequest[];

  /** AMC lead to attach (AMC Leads → + Quotation). Left out on edit = keep the current link. */
  amcLeadId?: string;
}

// ── Reference data ───────────────────────────────────────────────────

export const getCertificationTypes = async (): Promise<CertificationTypeOption[]> => {
  const res = await api.get<CertificationTypeOption[]>(
    "/finance/quotations/certification-types"
  );
  return res.data;
};

// ── CRUD ─────────────────────────────────────────────────────────────

export const createQuotation = async (
  req: CreateQuotationRequest
): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>("/finance/quotations", req);
  return res.data;
};

export const getAllQuotations = async (): Promise<QuotationResponse[]> => {
  const res = await api.get<QuotationResponse[]>("/finance/quotations");
  return res.data;
};

export const getQuotationById = async (id: string): Promise<QuotationDetailsResponse> => {
  const res = await api.get<QuotationDetailsResponse>(`/finance/quotations/${id}`);
  return res.data;
};

export const updateQuotation = async (
  id: string,
  req: CreateQuotationRequest
): Promise<QuotationDetailsResponse> => {
  const res = await api.put<QuotationDetailsResponse>(`/finance/quotations/${id}`, req);
  return res.data;
};

export const deleteQuotation = async (id: string): Promise<void> => {
  await api.delete(`/finance/quotations/${id}`);
};

/**
 * The most recent quotation of a type, used to auto-fill a new one.
 * Resolves to null when none exists yet (the backend answers 204), so the
 * form can simply start blank.
 */
export const getLatestQuotationByType = async (
  type: string
): Promise<QuotationDetailsResponse | null> => {
  const res = await api.get<QuotationDetailsResponse | "">(
    "/finance/quotations/latest",
    { params: { type } }
  );
  return res.status === 204 || !res.data ? null : (res.data as QuotationDetailsResponse);
};

/**
 * Whether an offer number is free. Pass excludeId when editing so the
 * quotation's own number doesn't count as taken.
 */
export const isOfferNumberAvailable = async (
  number: string,
  excludeId?: string
): Promise<boolean> => {
  const res = await api.get<{ available: boolean }>(
    "/finance/quotations/offer-number/available",
    { params: { number, excludeId } }
  );
  return res.data.available;
};

/**
 * Attach a quotation to a lead (or detach with null). Works at any status,
 * Accepted included — only the link changes, never the document. This is
 * what makes the quoted amount show up for Accounts on the Payments pages.
 */
export const linkQuotationToLead = async (
  id: string,
  leadId: string | null
): Promise<QuotationDetailsResponse> => {
  const res = await api.patch<QuotationDetailsResponse>(
    `/finance/quotations/${id}/lead`,
    { leadId }
  );
  return res.data;
};

/**
 * The quotation that decides "how much to collect" when a lead has several:
 * the accepted one first, then the latest sent, then anything else. A
 * rejected quotation is used only when there's nothing else to show.
 */
const QUOTE_PRIORITY: Record<string, number> = {
  ACCEPTED: 0,
  SENT: 1,
  EXPIRED: 2,
  DRAFT: 3,
  REJECTED: 4,
};

export const pickPrimaryQuotation = <T extends QuotationResponse>(list: T[]): T | undefined =>
  // A quotation we RECEIVED (client / vendor) is not our offer — only
  // fall back to it when the lead has nothing else.
  [...(list.some((q) => q.entryType !== "RECEIVED") ? list.filter((q) => q.entryType !== "RECEIVED") : list)].sort(
    (a, b) =>
      (QUOTE_PRIORITY[a.status] ?? 9) - (QUOTE_PRIORITY[b.status] ?? 9) ||
      (b.offerDate ?? "").localeCompare(a.offerDate ?? "")
  )[0];

// ── Duplicate ────────────────────────────────────────────────────────

/**
 * Copies a quotation into a fresh DRAFT with a new offer number and
 * today's date, every content block already filled in.
 *
 * This is what makes a hand-filled form workable: typing nine blocks from
 * scratch each time would be worse than the Canva files this replaces.
 * The team copies their last one and changes the client, product and
 * amounts — the same habit, now inside the CRM.
 */
export const duplicateQuotation = async (id: string): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>(`/finance/quotations/${id}/duplicate`);
  return res.data;
};

// ── Status ───────────────────────────────────────────────────────────

export const markQuotationSent = async (id: string): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>(`/finance/quotations/${id}/mark-sent`);
  return res.data;
};

export const setQuotationOutcome = async (
  id: string,
  status: "ACCEPTED" | "REJECTED"
): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>(
    `/finance/quotations/${id}/outcome`,
    null,
    { params: { status } }
  );
  return res.data;
};

// ── Scoped reads ─────────────────────────────────────────────────────

export const getQuotationsByLead = async (leadId: string): Promise<QuotationResponse[]> => {
  const res = await api.get<QuotationResponse[]>(`/finance/quotations/lead/${leadId}`);
  return res.data;
};

export const getQuotationsByIndependentProject = async (
  independentProjectId: string
): Promise<QuotationResponse[]> => {
  const res = await api.get<QuotationResponse[]>(
    `/finance/quotations/independent-project/${independentProjectId}`
  );
  return res.data;
};

// ── Helper: details -> form payload (used by Duplicate and Edit) ─────

export const detailsToRequest = (d: QuotationDetailsResponse): CreateQuotationRequest => ({
  certificationType: d.certificationType,
  offerNumber: d.offerNumber,
  offerDate: d.offerDate,
  validUntil: d.validUntil,
  leadId: d.leadId,
  independentProjectId: d.independentProjectId,
  clientName: d.clientName,
  clientCompany: d.clientCompany,
  clientEmail: d.clientEmail,
  clientMobile: d.clientMobile,
  kindAttention: d.kindAttention ?? "",
  introNote: d.introNote,
  introParagraph: d.introParagraph,
  projectDescription: d.projectDescription,
  functionalScope: d.functionalScope ?? [],
  totalTimeline: d.totalTimeline,
  basicAspects: d.basicAspects ?? [],
  basicRequirements: d.basicRequirements ?? [],
  basicRequirementsNote: d.basicRequirementsNote,
  sampleRequirements: d.sampleRequirements ?? [],
  sampleRemark: d.sampleRemark,
  sampleGuidelines: d.sampleGuidelines ?? [],
  workScope: d.workScope ?? [],
  terms: d.terms ?? [],
  paymentRatio: d.paymentRatio ?? [],
  showCurrencyColumn: d.showCurrencyColumn,
  closingNote: d.closingNote,
  signatoryName: d.signatoryName,
  signatoryTitle: d.signatoryTitle,
  remarks: d.remarks,
  lineItems: (d.lineItems ?? []).map((i) => ({
    category: i.category,
    description: i.description,
    amountInr: i.amountInr,
    amountUsd: i.amountUsd,
    remarks: i.remarks,
    isGovernmentFee: i.isGovernmentFee,
  })),
});

// ── AMC leads ───────────────────────────────────────────────────────────
// Same idea as the sales-lead endpoints above, for the AMC Leads page.

export const getQuotationsByAmcLead = async (amcLeadId: string): Promise<QuotationResponse[]> => {
  const res = await api.get<QuotationResponse[]>(`/finance/quotations/amc-lead/${amcLeadId}`);
  return res.data;
};

/** {amcLeadId: count} for the AMC leads on screen; leads with none are left out. */
export const fetchAmcLeadQuotationCounts = async (ids: string[]): Promise<Record<string, number>> => {
  if (ids.length === 0) return {};
  const res = await api.get<Record<string, number>>("/finance/quotations/amc-lead-counts", {
    params: { ids: ids.join(",") },
  });
  return res.data;
};

/** Attach a quotation to an AMC lead, or detach it with null. */
export const linkQuotationToAmcLead = async (
  quotationId: string,
  amcLeadId: string | null
): Promise<QuotationDetailsResponse> => {
  const res = await api.patch<QuotationDetailsResponse>(`/finance/quotations/${quotationId}/amc-lead`, {
    amcLeadId,
  });
  return res.data;
};

// ── Uploaded / received quotations, and revisions ───────────────────

/** Fields of the Upload Quotation form (all text, as sent in the form). */
export interface UploadQuotationFields {
  entryType: QuotationEntryType;
  certificationType?: string;
  /** Blank = next number in the series (or RCV/… for a received one). */
  offerNumber?: string;
  offerDate?: string;
  validUntil?: string;
  clientCompany?: string;
  clientName?: string;
  clientEmail?: string;
  clientMobile?: string;
  amount?: number | null;
  status?: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
  leadId?: string;
  amcLeadId?: string;
  /** Set = this is a revised version of that quotation. */
  revisionOfId?: string;
  remarks?: string;
}

// Two parts only — "file" and "details" (JSON). The server refuses a form
// with more than 10 parts, so one part per field would fail.
const toFormData = (fields: Partial<UploadQuotationFields>, file?: File | null) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  const details: Record<string, unknown> = {};
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined) details[k] = v;
  });
  fd.append("details", new Blob([JSON.stringify(details)], { type: "application/json" }));
  return fd;
};

/** Save a quotation made outside the CRM, or one we received, with its file. */
export const uploadQuotation = async (
  fields: UploadQuotationFields,
  file: File
): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>(
    "/finance/quotations/upload",
    toFormData(fields, file),
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
};

/** Edit an uploaded / received quotation; a new file replaces the old one. */
export const updateUploadedQuotation = async (
  id: string,
  fields: Partial<UploadQuotationFields>,
  file?: File | null
): Promise<QuotationDetailsResponse> => {
  const { revisionOfId: _ignored, ...rest } = fields;
  void _ignored;
  const res = await api.put<QuotationDetailsResponse>(
    `/finance/quotations/${id}/upload`,
    toFormData(rest, file),
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data;
};

/** The attached file as a Blob (the request needs the login token). */
export const getQuotationFile = async (id: string): Promise<Blob> => {
  const res = await api.get(`/finance/quotations/${id}/file`, { responseType: "blob" });
  return res.data as Blob;
};

/** Revised version of a CRM-made quotation: a new DRAFT copy, …/R1, same client and lead. */
export const reviseQuotation = async (id: string): Promise<QuotationDetailsResponse> => {
  const res = await api.post<QuotationDetailsResponse>(`/finance/quotations/${id}/revise`);
  return res.data;
};