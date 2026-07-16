export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

export const getStatusColor = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    ACTIVE: 'bg-green-100 text-green-800',
    CLOSED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    SUCCESS: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    LOST: 'bg-gray-100 text-gray-800',
  };
  return statusMap[status] || 'bg-gray-100 text-gray-800';
};

export const getStatusLabel = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    ACTIVE: 'Active',
    CLOSED: 'Closed',
    DRAFT: 'Draft',
    SUCCESS: 'Success',
    FAILED: 'Failed',
    LOST: 'Lost',
  };
  return statusMap[status] || status;
};

// Installment plan status badges (AmcInstallment.status)
export const getInstallmentStatusColor = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    PAID: 'bg-green-100 text-green-800 border-green-300',
    PARTIAL: 'bg-blue-100 text-blue-800 border-blue-300',
    PENDING: 'bg-gray-100 text-gray-700 border-gray-300',
    OVERDUE: 'bg-red-100 text-red-800 border-red-300',
  };
  return statusMap[status] || 'bg-gray-100 text-gray-700 border-gray-300';
};