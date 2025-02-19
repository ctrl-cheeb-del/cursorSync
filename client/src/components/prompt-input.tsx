import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function PromptInput({ onSubmit, isLoading }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        placeholder="Type your prompt here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[100px] resize-none"
      />
      <Button
        type="submit"
        className="w-full border-2 border-white text-white bg-transparent hover:bg-white/10"
        disabled={!prompt.trim() || isLoading}
      >
        <Send className="w-4 h-4 mr-2" />
        {isLoading ? "Processing..." : "Send to Cursor"}
      </Button>
    </form>
  );
}
