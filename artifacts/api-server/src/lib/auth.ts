import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userRole?: string;
    isFinanceAdmin?: boolean;
    securityQuestionsSet?: boolean;
    pending2fa?: boolean;
    pending2faUserId?: number;
    twoFactorOtp?: string;
    twoFactorOtpExpiry?: number;
    recoveryChallenge?: { token: string; email: string };
  }
}

// STAFF_ROLES: the six new platform roles introduced in the RBAC hardening phase.
// "super_admin" is retained for backward compatibility with existing admin accounts
// and functions as a CEO alias in all permission checks (same rights as "ceo").
// Legacy roles ("member", "group_admin", "org_admin") continue to exist in the
// users table for regular Chama members; they are intentionally excluded from
// STAFF_ROLES so that requireStaffGate / isStaffRole never grants them staff access.
export const STAFF_ROLES = [
  "ceo",
  "cto_admin",
  "it_support",
  "finance",
  "marketing",
  "relationship_manager",
  "super_admin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

// Permission keys mapped to allowed roles
export const PERMISSIONS = {
  "auditLogs:read": ["ceo", "super_admin", "cto_admin", "it_support", "finance"],
  "auditLogs:full": ["ceo", "super_admin", "cto_admin", "it_support"],
  "users:manage": ["ceo", "super_admin", "cto_admin", "it_support"],
  "roles:assign": ["ceo", "super_admin", "cto_admin"],
  "roles:request": ["it_support"],
  "departments:manage": ["ceo", "super_admin", "cto_admin"],
  "departments:view": ["ceo", "super_admin", "cto_admin"],
  "organizations:full": ["ceo", "super_admin", "relationship_manager"],
  "organizations:view": ["ceo", "super_admin", "cto_admin", "it_support", "finance", "relationship_manager"],
  "groups:full": ["ceo", "super_admin", "relationship_manager"],
  "groups:view": ["ceo", "super_admin", "cto_admin", "it_support", "finance", "relationship_manager"],
  "finance:full": ["ceo", "super_admin", "finance"],
  "finance:view": ["ceo", "super_admin", "cto_admin", "finance", "relationship_manager"],
  "newsletter:manage": ["ceo", "super_admin", "marketing"],
  "support:full": ["ceo", "super_admin", "cto_admin", "it_support"],
  "support:view": ["ceo", "super_admin", "cto_admin", "it_support", "relationship_manager"],
  "chat:manage": ["ceo", "super_admin", "relationship_manager"],
  "accountUnlock:manage": ["ceo", "super_admin", "cto_admin", "it_support"],
  "security:manage": ["ceo", "super_admin", "cto_admin", "it_support"],
  "financeApprovals:approve": ["ceo", "super_admin", "finance"],
  "roleRequests:approve": ["ceo", "super_admin", "cto_admin"],
  // group_admin and org_admin intentionally included: they can complete payouts scoped to
  // their own group. finance staff route through the dual-control approval queue instead.
  "payouts:manage": ["super_admin", "ceo", "group_admin", "org_admin", "finance"],
  "dashboard:adminStats": ["ceo", "super_admin", "cto_admin", "it_support", "finance"],
  "swapRequests:adminView": ["ceo", "super_admin", "cto_admin", "it_support"],
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasPermission(role: string, permission: PermissionKey): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

/**
 * Middleware that enforces the security-questions gate for staff users without
 * requiring a specific permission. Use after `requireAuth` on any route where
 * staff receive elevated access via inline `hasPermission()` checks.
 */
export function requireStaffGate(req: Request, res: Response, next: NextFunction): void {
  const role = req.session?.userRole ?? "";
  if (isStaffRole(role) && req.session?.securityQuestionsSet === false) {
    res.status(403).json({ error: "securityQuestionsRequired", message: "You must set up security questions before accessing staff resources." });
    return;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  // CEO is equivalent to super_admin for backward compat
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const userRole = req.session.userRole ?? "";
    const expanded = [...roles];
    if (roles.includes("super_admin")) expanded.push("ceo");
    if (roles.includes("ceo")) expanded.push("super_admin");
    if (!expanded.includes(userRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // Staff users must complete security questions setup before accessing protected resources
    if (isStaffRole(userRole) && req.session.securityQuestionsSet === false) {
      res.status(403).json({ error: "securityQuestionsRequired", message: "You must set up security questions before accessing staff resources." });
      return;
    }
    next();
  };
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const role = req.session.userRole ?? "";
    // Staff users must complete security questions setup before accessing protected resources
    if (isStaffRole(role) && req.session.securityQuestionsSet === false) {
      res.status(403).json({ error: "securityQuestionsRequired", message: "You must set up security questions before accessing staff resources." });
      return;
    }
    const allowed = PERMISSIONS[permission] as readonly string[];
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireStaff() {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!isStaffRole(req.session.userRole ?? "")) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
