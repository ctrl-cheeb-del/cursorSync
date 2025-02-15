import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const prompts = pgTable("prompts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "rejected"] }).notNull().default("pending"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const screenshots = pgTable("screenshots", {
  id: serial("id").primaryKey(),
  promptId: serial("prompt_id").references(() => prompts.id),
  imageUrl: text("image_url").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertPromptSchema = createInsertSchema(prompts).pick({
  content: true
});

export type InsertPrompt = z.infer<typeof insertPromptSchema>;
export type Prompt = typeof prompts.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
