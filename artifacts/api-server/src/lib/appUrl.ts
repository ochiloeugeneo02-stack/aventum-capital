import type { Request } from "express";

const DEFAULT_PUBLIC_BASE_URL = "https://aventumcapital.com";

function cleanBaseUrl(value: string | undefined | null): string | null {
  if (!value) return null;
  return value.trim().replace(/\/+$/, "") || null;
}

function forwardedHost(req: Request): string | null {
  const forwarded = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwarded || req.get("host") || null;
}

export function getAppBaseUrl(req?: Request): string {
  const configured = cleanBaseUrl(process.env.APP_BASE_URL);
  if (configured) return configured;

  if (req) {
    const host = forwardedHost(req);
    if (host) {
      const protocol = req.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.protocol || "https";
      return cleanBaseUrl(`${protocol}://${host}`) ?? DEFAULT_PUBLIC_BASE_URL;
    }
  }

  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomain) return `https://${replitDomain}`;

  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;

  return process.env.NODE_ENV === "production"
    ? DEFAULT_PUBLIC_BASE_URL
    : `http://localhost:${process.env.PORT ?? 8080}`;
}