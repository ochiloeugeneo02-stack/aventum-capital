import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const financeApprovalRequestsTable = pgTable("finance_approval_requests", {
  id: serial("id").primaryKey(),
  requestedBy: integer("requested_by").notNull(),
  actionType: text("action_type").notNull(),
  actionPayload: text("action_payload").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFinanceApprovalRequestSchema = createInsertSchema(financeApprovalRequestsTable).omit({ id: true, createdAt: true });
export type InsertFinanceApprovalRequest = z.infer<typeof insertFinanceApprovalRequestSchema>;
export type FinanceApprovalRequest = typeof financeApprovalRequestsTable.$inferSelect;
