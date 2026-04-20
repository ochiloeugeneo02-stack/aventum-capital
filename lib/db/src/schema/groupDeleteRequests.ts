import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const groupDeleteRequestsTable = pgTable("group_delete_requests", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  requestedBy: integer("requested_by").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewNote: text("review_note"),
  disbursementNote: text("disbursement_note"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export type GroupDeleteRequest = typeof groupDeleteRequestsTable.$inferSelect;

export const groupDeleteRequestStatusSchema = z.enum(["pending", "approved", "rejected"]);
