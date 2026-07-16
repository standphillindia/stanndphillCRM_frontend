// src/constants/documentConstants.ts

export const DOCUMENT_TYPES = [
  { value: "BIS_CERTIFICATE",           label: "BIS Certificate",            icon: "verified" },
  { value: "LICENSE_COPY",              label: "License Copy",               icon: "badge" },
  { value: "APPLICATION_FORM",          label: "Application Form",           icon: "description" },
  { value: "TEST_REPORT",               label: "Test Report",                icon: "science" },
  { value: "FACTORY_INSPECTION_REPORT", label: "Factory Inspection Report",  icon: "factory" },
  { value: "GST_CERTIFICATE",           label: "GST Certificate",            icon: "receipt_long" },
  { value: "PAN_CARD",                  label: "PAN Card",                   icon: "badge" },
  { value: "INCORPORATION_CERTIFICATE", label: "Incorporation Certificate",  icon: "domain" },
  { value: "KYC",                       label: "KYC Document",               icon: "fingerprint" },
  { value: "INVOICE",                   label: "Invoice",                    icon: "request_quote" },
  { value: "OTHER",                     label: "Other",                      icon: "folder" },
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number]["value"];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.label])
) as Record<DocumentType, string>;

export const DOCUMENT_TYPE_ICON: Record<DocumentType, string> = Object.fromEntries(
  DOCUMENT_TYPES.map((t) => [t.value, t.icon])
) as Record<DocumentType, string>;