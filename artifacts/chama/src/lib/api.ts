export function getApiBaseUrl() {
  return "/api";
}

let _locale = "en-US";
let _currency = "USD";
let _usdRate = 1;
let _fractionDigits = 2;

export function _setRegionConfig(
  locale: string,
  currency: string,
  usdRate: number,
  fractionDigits: number
) {
  _locale = locale;
  _currency = currency;
  _usdRate = usdRate;
  _fractionDigits = fractionDigits;
}

export function formatCurrency(amount: number): string {
  const converted = amount * _usdRate;
  return new Intl.NumberFormat(_locale, {
    style: "currency",
    currency: _currency,
    minimumFractionDigits: _fractionDigits,
    maximumFractionDigits: _fractionDigits,
  }).format(converted);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(_locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(_locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function apiRequest<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: any = new Error(data?.error ?? `Request failed ${res.status}`);
    err.data = data;
    throw err;
  }
  return data as T;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
      return "text-green-700 bg-green-50 border-green-200";
    case "pending":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "failed":
      return "text-red-700 bg-red-50 border-red-200";
    case "active":
      return "text-green-700 bg-green-50 border-green-200";
    case "paused":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "awaiting_cycle_approval":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "completed":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "deleted":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-gray-700 bg-gray-50 border-gray-200";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_cycle_approval": return "Awaiting approval";
    case "active": return "Active";
    case "paused": return "Paused";
    case "completed": return "Completed";
    case "deleted": return "Deleted";
    case "paid": return "Paid";
    case "pending": return "Pending";
    case "failed": return "Failed";
    default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  }
}
