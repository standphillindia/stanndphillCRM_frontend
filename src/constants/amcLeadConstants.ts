// src/constants/amcLeadConstants.ts
// Constants for AMC Leads module

export const AMC_LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "QUOTATION_SENT", label: "Quotation Sent" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "AMC_WON", label: "AMC Won" },
  { value: "AMC_LOST", label: "AMC Lost" },
  { value: "CONVERTED", label: "Converted" },
] as const;

export type AMCLeadStatus = (typeof AMC_LEAD_STATUSES)[number]["value"];

export const AMC_LEAD_SOURCES = [
  { value: "MANUAL", label: "Manual" },
  { value: "WEBSITE", label: "Website" },
  { value: "PHONE", label: "Phone" },
  { value: "EMAIL", label: "Email" },
  { value: "REFERRAL", label: "Referral" },
  { value: "SOCIAL_MEDIA", label: "Social Media" },
  { value: "ADVERTISEMENT", label: "Advertisement" },
  { value: "OTHER", label: "Other" },
] as const;

export type AMCLeadSource = (typeof AMC_LEAD_SOURCES)[number]["value"];