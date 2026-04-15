export function getApiBaseUrl() {
  return "/api";
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "paid": return "text-green-700 bg-green-50 border-green-200";
    case "pending": return "text-amber-700 bg-amber-50 border-amber-200";
    case "failed": return "text-red-700 bg-red-50 border-red-200";
    case "active": return "text-green-700 bg-green-50 border-green-200";
    case "paused": return "text-amber-700 bg-amber-50 border-amber-200";
    case "completed": return "text-blue-700 bg-blue-50 border-blue-200";
    default: return "text-gray-700 bg-gray-50 border-gray-200";
  }
}
