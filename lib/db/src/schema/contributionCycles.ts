import { pgTable, serial, integer, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contributionCyclesTable = pgTable("contribution_cycles", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  cycleNumber: integer("cycle_number").notNull().default(1),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContributionCycleSchema = createInsertSchema(contributionCyclesTable).omit({ id: true, createdAt: true });
export type InsertContributionCycle = z.infer<typeof insertContributionCycleSchema>;
export type ContributionCycle = typeof contributionCyclesTable.$inferSelect;
