// Zod schemas (runtime values) — used by api-server for request validation
export * from "./generated/api";
// TypeScript interface types (type-only) — these are separate from the Zod
// schema values above and live in different TypeScript declaration spaces.
// Re-exporting them as type-only avoids any runtime value collision.
// Note: Body types (CreateGroupBody, UpdateUserBody, etc.) deliberately
// omitted here because they share names with the Zod schemas above; consumers
// should use z.infer<typeof SchemaName> to get the equivalent TypeScript type.
export type { UserRole } from "./generated/types/userRole";
export type { User } from "./generated/types/user";
export type { Group } from "./generated/types/group";
export type { Organization } from "./generated/types/organization";
export type { Contribution } from "./generated/types/contribution";
export type { Payout } from "./generated/types/payout";
export type { AuditLog } from "./generated/types/auditLog";
export type { AuditLogListResponse } from "./generated/types/auditLogListResponse";
export type { AdminStats } from "./generated/types/adminStats";
export type { DashboardSummary } from "./generated/types/dashboardSummary";
export type { GroupDetails } from "./generated/types/groupDetails";
export type { GroupMember } from "./generated/types/groupMember";
export type { AuthResponse } from "./generated/types/authResponse";
export type { ErrorResponse } from "./generated/types/errorResponse";
