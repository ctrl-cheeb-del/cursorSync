import { z } from "zod";

export const insertPromptSchema = z.object({
  content: z.string(),
});

export type InsertPrompt = z.infer<typeof insertPromptSchema>;

export const promptSchema = insertPromptSchema.extend({
  id: z.number(),
  status: z.enum(["pending", "processing", "completed", "rejected"]),
  timestamp: z.string().datetime(),
});

export type Prompt = z.infer<typeof promptSchema>; 