import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exitRequestsTable = pgTable("exit_requests", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  reason: text("reason"),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNote: text("review_note"),
  autoApproveAfterCycle: integer("auto_approve_after_cycle"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExitRequestSchema = createInsertSchema(exitRequestsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertExitRequest = z.infer<typeof insertExitRequestSchema>;
export type ExitRequest = typeof exitRequestsTable.$inferSelect;
