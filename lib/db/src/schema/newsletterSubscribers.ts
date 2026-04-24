import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("landing_page"),
  confirmed: boolean("confirmed").notNull().default(true),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
