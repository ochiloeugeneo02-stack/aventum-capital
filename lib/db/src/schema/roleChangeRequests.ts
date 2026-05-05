import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleChangeRequestsTable = pgTable("role_change_requests", {
  id: serial("id").primaryKey(),
  requestedBy: integer("requested_by").notNull(),
  targetUserId: integer("target_user_id").notNull(),
  requestedRole: text("requested_role").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoleChangeRequestSchema = createInsertSchema(roleChangeRequestsTable).omit({ id: true, createdAt: true });
export type InsertRoleChangeRequest = z.infer<typeof insertRoleChangeRequestSchema>;
export type RoleChangeRequest = typeof roleChangeRequestsTable.$inferSelect;
