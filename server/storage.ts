import { type Prompt, type InsertPrompt } from "@shared/schema";

export interface IStorage {
  createPrompt(prompt: InsertPrompt): Promise<Prompt>;
  getPrompt(id: number): Promise<Prompt | undefined>;
  getPrompts(): Promise<Prompt[]>;
  updatePromptStatus(id: number, status: string): Promise<Prompt>;
}

export class MemStorage implements IStorage {
  private prompts: Map<number, Prompt>;
  private currentId: number;

  constructor() {
    this.prompts = new Map();
    this.currentId = 1;
  }

  async createPrompt(insertPrompt: InsertPrompt): Promise<Prompt> {
    const id = this.currentId++;
    const prompt: Prompt = {
      id,
      content: insertPrompt.content,
      status: "pending",
      timestamp: new Date(),
    };
    this.prompts.set(id, prompt);
    return prompt;
  }

  async getPrompt(id: number): Promise<Prompt | undefined> {
    return this.prompts.get(id);
  }

  async getPrompts(): Promise<Prompt[]> {
    return Array.from(this.prompts.values()).sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  async updatePromptStatus(id: number, status: string): Promise<Prompt> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }
    const updatedPrompt = { ...prompt, status };
    this.prompts.set(id, updatedPrompt);
    return updatedPrompt;
  }
}

export const storage = new MemStorage();
