/**
 * Dynamic "Scan & Pay (UPI)" QR for invoices.
 *
 * Generates a per-invoice QR (amount + invoice number pre-filled) on mount.
 * If per-invoice generation ever fails, it falls back to an open-amount
 * UPI QR (same VPA, no amount) so the invoice is never missing a payable QR.
 *
 * Renders a plain <img> with a base64 data-URL, so html2canvas → jsPDF
 * export works exactly like a static image (no CORS, no taint issues).
 */

import React, { useEffect, useState } from "react";
import { generateUpiQrDataUrl } from "../../utils/upiQr";

export interface UpiQrProps {
  /** Invoice total in INR (e.g. tax.totalAmount). Omit for open-amount QR. */
  amount?: number;
  /** Invoice number for the UPI transaction note, e.g. "PI-2026-0024". */
  note?: string;
  className?: string;
  alt?: string;
}

const UpiQr: React.FC<UpiQrProps> = ({
  amount,
  note,
  className,
  alt = "Scan to pay via UPI",
}) => {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    generateUpiQrDataUrl({ amount, note })
      .then((dataUrl: string) => {
        if (!cancelled) {
          setSrc(dataUrl);
        }
      })
      .catch(() => {
        // Fallback: open-amount QR (no amount / note) — same VPA, so the
        // customer can still pay by typing the amount manually.
        generateUpiQrDataUrl()
          .then((dataUrl: string) => {
            if (!cancelled) {
              setSrc(dataUrl);
            }
          })
          .catch(() => {
            // QR generation is pure JS; reaching here is practically
            // impossible. Leave src empty rather than crash the invoice.
          });
      });

    return () => {
      cancelled = true;
    };
  }, [amount, note]);

  // Render nothing until the data-URL is ready (~few ms) so html2canvas
  // never snapshots a broken-image icon.
  if (!src) {
    return null;
  }

  return <img src={src} alt={alt} className={className} />;
};

export default UpiQr;