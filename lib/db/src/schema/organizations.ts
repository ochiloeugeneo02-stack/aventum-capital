import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  adminId: integer("admin_id").notNull(),

  // Enterprise profile
  plan: text("plan").notNull().default("free"),           // free | starter | professional | enterprise | custom
  status: text("status").notNull().default("active"),     // active | trial | suspended | churned
  industry: text("industry"),
  website: text("website"),
  billingEmail: text("billing_email"),
  employeeCount: text("employee_count"),                  // stored as text range e.g. "11-50"
  logoUrl: text("logo_url"),

  // Aventum account management
  accountManager: text("account_manager"),
  contractStart: timestamp("contract_start", { withTimezone: true }),
  contractEnd: timestamp("contract_end", { withTimezone: true }),
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
