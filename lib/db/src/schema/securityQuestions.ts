import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const securityQuestionsTable = pgTable("security_questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  questionIndex: integer("question_index").notNull(),
  questionText: text("question_text").notNull(),
  answerHash: text("answer_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSecurityQuestionSchema = createInsertSchema(securityQuestionsTable).omit({ id: true, createdAt: true });
export type InsertSecurityQuestion = z.infer<typeof insertSecurityQuestionSchema>;
export type SecurityQuestion = typeof securityQuestionsTable.$inferSelect;
