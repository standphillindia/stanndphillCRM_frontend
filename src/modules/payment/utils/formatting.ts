export function formatCurrency(value: number | string): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "₹0.00";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function getStatusBadgeColor(status: string): string {
  const statusLower = (status || "").toLowerCase();

  switch (statusLower) {
    case "paid":
      return "bg-green-100 text-green-800 border border-green-300";
    case "pending":
      return "bg-orange-100 text-orange-800 border border-orange-300";
    case "partial":
      return "bg-blue-100 text-blue-800 border border-blue-300";
    case "overdue":
      return "bg-red-100 text-red-800 border border-red-300";
    case "pi_pending":
      return "bg-yellow-100 text-yellow-800 border border-yellow-300";
    case "pi_sent":
      return "bg-blue-100 text-blue-800 border border-blue-300";
    case "payment_received":
      return "bg-green-100 text-green-800 border border-green-300";
    case "ti_sent":
      return "bg-purple-100 text-purple-800 border border-purple-300";
    case "project_created":
      return "bg-indigo-100 text-indigo-800 border border-indigo-300";
    default:
      return "bg-slate-100 text-slate-800 border border-slate-300";
  }
}

export function calculateCollectionPercentage(
  paidAmount: number,
  totalAmount: number
): number {
  if (totalAmount === 0) return 0;
  return (paidAmount / totalAmount) * 100;
}