import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { _setRegionConfig } from "@/lib/api";

export interface RegionInfo {
  code: string;
  name: string;
  currency: string;
  locale: string;
  flag: string;
  fractionDigits: number;
  usdRate: number;
}

export const DEFAULT_REGION_CODE = "US";
export const DEFAULT_CURRENCY = "USD";

export const REGIONS: Record<string, RegionInfo> = {
  KE: {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    locale: "en-KE",
    flag: "🇰🇪",
    fractionDigits: 0,
    usdRate: 130,
  },
  US: {
    code: "US",
    name: "United States",
    currency: "USD",
    locale: "en-US",
    flag: "🇺🇸",
    fractionDigits: 2,
    usdRate: 1,
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: "GBP",
    locale: "en-GB",
    flag: "🇬🇧",
    fractionDigits: 2,
    usdRate: 0.79,
  },
  EU: {
    code: "EU",
    name: "Europe",
    currency: "EUR",
    locale: "en-DE",
    flag: "🇪🇺",
    fractionDigits: 2,
    usdRate: 0.92,
  },
  CA: {
    code: "CA",
    name: "Canada",
    currency: "CAD",
    locale: "en-CA",
    flag: "🇨🇦",
    fractionDigits: 2,
    usdRate: 1.35,
  },
  AU: {
    code: "AU",
    name: "Australia",
    currency: "AUD",
    locale: "en-AU",
    flag: "🇦🇺",
    fractionDigits: 2,
    usdRate: 1.53,
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    locale: "en-NG",
    flag: "🇳🇬",
    fractionDigits: 0,
    usdRate: 1600,
  },
  TZ: {
    code: "TZ",
    name: "Tanzania",
    currency: "TZS",
    locale: "sw-TZ",
    flag: "🇹🇿",
    fractionDigits: 0,
    usdRate: 2600,
  },
  UG: {
    code: "UG",
    name: "Uganda",
    currency: "UGX",
    locale: "sw-UG",
    flag: "🇺🇬",
    fractionDigits: 0,
    usdRate: 3700,
  },
};

const TIMEZONE_TO_REGION: Record<string, string> = {
  "Africa/Nairobi": "KE",
  "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG",
  "Africa/Lagos": "NG",
  "Africa/Abidjan": "EU",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Phoenix": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "Europe/London": "GB",
  "Europe/Berlin": "EU",
  "Europe/Paris": "EU",
  "Europe/Amsterdam": "EU",
  "Europe/Madrid": "EU",
  "Europe/Rome": "EU",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
};

function detectRegionCode(): string {
  const saved = localStorage.getItem("aventum_region");
  if (saved && REGIONS[saved]) return saved;

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_REGION[tz]) return TIMEZONE_TO_REGION[tz];

    if (tz?.startsWith("Africa/")) return "NG";
    if (tz?.startsWith("America/")) return "US";
    if (tz?.startsWith("Europe/")) return "EU";
    if (tz?.startsWith("Australia/") || tz?.startsWith("Pacific/")) return "AU";
  } catch {}

  try {
    const lang = navigator.language || "";
    if (lang.startsWith("sw") || lang === "en-KE") return "KE";
    if (lang === "en-US") return "US";
    if (lang === "en-GB") return "GB";
    if (lang === "en-CA") return "CA";
    if (lang === "en-AU") return "AU";
  } catch {}

  return "US";
}

export const CURRENCY_TO_USDRATE: Record<string, number> = Object.fromEntries(
  Object.values(REGIONS).map((r) => [r.currency, r.usdRate])
);

interface RegionContextValue {
  region: RegionInfo;
  setRegion: (code: string) => void;
  formatCurrency: (amount: number) => string;
  formatGroupAmount: (amount: number, fromCurrency: string) => string;
  formatDate: (dateStr: string | null | undefined) => string;
  formatDateTime: (dateStr: string | null | undefined) => string;
  convertToDefaultCurrency: (amountLocal: number) => number;
}

const RegionContext = createContext<RegionContextValue | null>(null);

export function RegionProvider({ children }: { children: ReactNode }) {
  const [regionCode, setRegionCode] = useState<string>(() => detectRegionCode());

  const region = REGIONS[regionCode] ?? REGIONS[DEFAULT_REGION_CODE];

  _setRegionConfig(region.locale, region.currency, region.usdRate, region.fractionDigits);

  const handleSetRegion = useCallback((code: string) => {
    if (!REGIONS[code]) return;
    localStorage.setItem("aventum_region", code);
    setRegionCode(code);
  }, []);

  const formatCurrency = useCallback(
    (amount: number): string => {
      const converted = amount * region.usdRate;
      return new Intl.NumberFormat(region.locale, {
        style: "currency",
        currency: region.currency,
        minimumFractionDigits: region.fractionDigits,
        maximumFractionDigits: region.fractionDigits,
      }).format(converted);
    },
    [region]
  );

  const formatDate = useCallback(
    (dateStr: string | null | undefined): string => {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleDateString(region.locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },
    [region]
  );

  const formatDateTime = useCallback(
    (dateStr: string | null | undefined): string => {
      if (!dateStr) return "—";
      return new Date(dateStr).toLocaleString(region.locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    [region]
  );

  const convertToDefaultCurrency = useCallback(
    (amountLocal: number): number => {
      if (region.usdRate === 0) return amountLocal;
      return Math.round(amountLocal / region.usdRate);
    },
    [region]
  );

  const formatGroupAmount = useCallback(
    (amount: number, groupCurrency: string): string => {
      try {
        const digits = REGIONS[Object.keys(REGIONS).find(k => REGIONS[k].currency === groupCurrency) ?? ""]?.fractionDigits ?? 0;
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: groupCurrency,
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        }).format(amount);
      } catch {
        return `${groupCurrency} ${amount.toLocaleString()}`;
      }
    },
    []
  );

  return (
    <RegionContext.Provider
      value={{ region, setRegion: handleSetRegion, formatCurrency, formatGroupAmount, formatDate, formatDateTime, convertToDefaultCurrency }}
    >
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
