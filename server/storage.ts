import type { InsertPrompt, Prompt } from "./schema";

class Storage {
  private prompts: Prompt[] = [];
  private nextId = 1;

  async createPrompt(data: InsertPrompt): Promise<Prompt> {
    const prompt: Prompt = {
      ...data,
      id: this.nextId++,
      status: "pending",
      timestamp: new Date().toISOString(),
    };
    this.prompts.push(prompt);
    return prompt;
  }

  async getPrompts(): Promise<Prompt[]> {
    return this.prompts;
  }

  async getPrompt(id: number): Promise<Prompt | undefined> {
    return this.prompts.find(p => p.id === id);
  }

  async updatePromptStatus(id: number, status: Prompt["status"]): Promise<Prompt> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      throw new Error("Prompt not found");
    }
    prompt.status = status;
    return prompt;
  }
}

export const storage = new Storage();
