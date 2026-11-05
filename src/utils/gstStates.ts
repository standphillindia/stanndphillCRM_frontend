// src/utils/gstStates.ts
//
// GST state codes (first two digits of a GSTIN) and state names, for the
// "State Name / State Code" lines a Tax Invoice must carry.

export const GST_STATES: { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** State name for a code ("09" → "Uttar Pradesh"). */
export const stateNameForCode = (code?: string | null) =>
  GST_STATES.find((s) => s.code === code?.trim().padStart(2, "0"))?.name ?? null;

/** Code for a state name, forgiving about spaces / case / "&". */
export const stateCodeForName = (name?: string | null) => {
  if (!name?.trim()) return null;
  const n = norm(name);
  return GST_STATES.find((s) => norm(s.name) === n)?.code ?? null;
};

/**
 * The client's state for the invoice: the Place of Supply typed on the
 * invoice wins; otherwise it is read from the first two digits of the
 * client's GSTIN. Returns nulls when neither is known.
 */
export const resolveClientState = (
  placeOfSupply?: string | null,
  clientGst?: string | null
): { name: string | null; code: string | null } => {
  const fromPlace = placeOfSupply?.trim();
  if (fromPlace) {
    const code = stateCodeForName(fromPlace);
    return { name: code ? stateNameForCode(code) : fromPlace, code };
  }
  const gst = clientGst?.trim();
  if (gst && /^\d{2}/.test(gst)) {
    const code = gst.slice(0, 2);
    const name = stateNameForCode(code);
    if (name) return { name, code };
  }
  return { name: null, code: null };
};