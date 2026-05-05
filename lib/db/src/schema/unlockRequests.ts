import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const unlockRequestsTable = pgTable("unlock_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUnlockRequestSchema = createInsertSchema(unlockRequestsTable).omit({ id: true, createdAt: true });
export type InsertUnlockRequest = z.infer<typeof insertUnlockRequestSchema>;
export type UnlockRequest = typeof unlockRequestsTable.$inferSelect;
