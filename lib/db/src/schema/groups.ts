import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const groupsTable = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminId: integer("admin_id").notNull(),
  organizationId: integer("organization_id"),
  currency: text("currency").notNull().default("KES"),
  contributionAmount: numeric("contribution_amount", { precision: 12, scale: 2 }).notNull(),
  schedule: text("schedule").notNull().default("bi-weekly"),
  maxMembers: integer("max_members").notNull().default(5),
  currentCycle: integer("current_cycle").notNull().default(1),
  currentRotationIndex: integer("current_rotation_index").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGroupSchema = createInsertSchema(groupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groupsTable.$inferSelect;
