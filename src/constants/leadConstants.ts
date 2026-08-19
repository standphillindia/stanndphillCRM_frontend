export const LEAD_STATUSES = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "FOLLOW_UP", label: "Follow Up" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "NEGOTIATION", label: "Negotiation" },
  { value: "PI_RAISED", label: "PI Raised" },
  { value: "PAYMENT_RECEIVED", label: "Payment Received" },
  { value: "READY_TO_WON", label: "Ready to Won" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];

/**
 * Backend Enum:
 * MANUAL
 * WEBSITE
 * WHATSAPP
 * JUSTDIAL
 * META_ADS
 * INSTAMART
 */
export const LEAD_SOURCES = [
  {
    value: "MANUAL",
    label: "Phone",
  },
  {
    value: "WEBSITE",
    label: "Website",
  },
  {
    value: "WHATSAPP",
    label: "WhatsApp",
  },
  {
    value: "JUSTDIAL",
    label: "JustDial",
  },
  {
    value: "META_ADS",
    label: "Meta Ads",
  },
  {
    value: "INSTAMART",
    label: "Instamart",
  },
] as const;

export type LeadSource = (typeof LEAD_SOURCES)[number]["value"];

export const GST_RATES = [
  {
    value: 18,
    label: "18%",
    description: "IGST 18%",
  },
  {
    value: 12,
    label: "12%",
    description: "IGST 12%",
  },
  {
    value: 5,
    label: "5%",
    description: "IGST 5%",
  },
  {
    value: 28,
    label: "28%",
    description: "IGST 28%",
  },
] as const;

export const TAX_INVOICE_DEFAULTS = {
  SERVICE: "Consulting Service",
  HSN: "9983",
  TAXABLE_BASE: 0,
  IGST_RATE: 18,
} as const;

export const SELLER_INFO = {
  NAME: "STANDPHILL INDIA",
  GST: "09AEZFS7173R1ZG",
  PAN: "AEZFS7173R",
  EMAIL: "info@standphillindia.in",
  PHONE: "+91-9667674225",
  ADDRESS:
    "Floor No-10, Unit No-A 1024, Tower-3, NX ONE Techzone-4, Nearby Gaur City Mall, Greater Noida, Gautambuddha Nagar, Uttar Pradesh, 201318",
} as const;

export const BANK_DETAILS = {
  BANK_NAME: "HDFC BANK",
  ACCOUNT_HOLDER: "STANDPHILL INDIA",
  ACCOUNT_NO: "50200082603304",
  IFSC_CODE: "HDFC0003987",
} as const;