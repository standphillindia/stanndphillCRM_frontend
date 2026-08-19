// Central list of authorised signatories available for PI/TI invoices.
// To rename someone, just edit `name` below — it's used both as the
// dropdown label when creating/editing an invoice and as the printed
// name under the signature on the invoice itself.
// To add/replace a signature image, drop the PNG in
// src/assets/signatures/ and add an entry here.

import signature1 from "../assets/signatures/signature1.png";
import signature2 from "../assets/signatures/signature2.png";

export interface Signatory {
  id: string;
  name: string;
  imageUrl: string;
}

export const SIGNATORIES: Signatory[] = [
  { id: "signatory-1", name: "Mayank Pal ", imageUrl: signature1 },
  { id: "signatory-2", name: "Abhishek Chaturvedi", imageUrl: signature2 },
];

export function getSignatoryByName(name?: string | null): Signatory | undefined {
  if (!name) return undefined;
  return SIGNATORIES.find((s) => s.name === name);
}