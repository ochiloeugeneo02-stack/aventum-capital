import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const turnSwapRequestsTable = pgTable("turn_swap_requests", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  requesterId: integer("requester_id").notNull(),
  targetMemberId: integer("target_member_id").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  groupAdminId: integer("group_admin_id"),
  groupAdminDecidedAt: timestamp("group_admin_decided_at", { withTimezone: true }),
  superAdminDecidedAt: timestamp("super_admin_decided_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TurnSwapRequest = typeof turnSwapRequestsTable.$inferSelect;
