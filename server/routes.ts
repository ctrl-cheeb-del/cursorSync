import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { insertPromptSchema } from "@shared/schema";

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  app.post("/api/prompts", async (req, res) => {
    try {
      const promptData = insertPromptSchema.parse(req.body);
      const prompt = await storage.createPrompt(promptData);
      res.json(prompt);
    } catch (error) {
      res.status(400).json({ error: "Invalid prompt data" });
    }
  });

  app.get("/api/prompts", async (_req, res) => {
    const prompts = await storage.getPrompts();
    res.json(prompts);
  });

  app.get("/api/prompts/:id", async (req, res) => {
    const prompt = await storage.getPrompt(Number(req.params.id));
    if (!prompt) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.json(prompt);
  });

  app.patch("/api/prompts/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "processing", "completed", "rejected"].includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }
      const prompt = await storage.updatePromptStatus(Number(req.params.id), status);
      res.json(prompt);
    } catch (error) {
      res.status(404).json({ error: "Prompt not found" });
    }
  });

  return httpServer;
}
