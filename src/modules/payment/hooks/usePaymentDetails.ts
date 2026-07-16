import { useEffect, useState } from "react";
import {
  getPaymentDetails,
  getPaymentTransactions,
  getInvoiceHistory,
} from "../../../services/paymentService";

import type {
  PaymentDetailsResponse,
  PaymentTransactionResponse,
  InvoiceHistoryResponse,
} from "../types/payment.types";

interface UsePaymentDetailsReturn {
  details: PaymentDetailsResponse | null;
  transactions: PaymentTransactionResponse[];
  invoiceHistory: InvoiceHistoryResponse[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePaymentDetails(paymentId: string): UsePaymentDetailsReturn {
  const [details, setDetails] = useState<PaymentDetailsResponse | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionResponse[]>(
    []
  );
  const [invoiceHistory, setInvoiceHistory] = useState<InvoiceHistoryResponse[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailsRes, transactionsRes, invoiceRes] = await Promise.all([
        getPaymentDetails(paymentId),
        getPaymentTransactions(paymentId),
        getInvoiceHistory(paymentId),
      ]);

      setDetails(detailsRes);
      setTransactions(transactionsRes);
      setInvoiceHistory(invoiceRes);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch payment details";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paymentId) {
      fetchAll();
    }
  }, [paymentId]);

  return {
    details,
    transactions,
    invoiceHistory,
    loading,
    error,
    refetch: fetchAll,
  };
}