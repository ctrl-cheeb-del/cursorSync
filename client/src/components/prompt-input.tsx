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
    <form onSubmit={handleSubmit} className="relative space-y-2 p-1">
      <Textarea
        placeholder="Type your prompt here..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="min-h-[100px] resize-none bg-transparent border-0 ring-1 ring-white/20 focus-visible:ring-white/30 rounded-xl placeholder:text-white/50 text-base p-4"
      />
      <Button
        type="submit"
        className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-500/80 to-blue-500/80 text-white shadow-lg transition-all hover:scale-[1.01] hover:shadow-xl disabled:pointer-events-none disabled:opacity-50 h-12"
        disabled={!prompt.trim() || isLoading}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <div className="relative flex items-center justify-center gap-2">
          <Send className="w-4 h-4" />
          <span className="font-medium">
            {isLoading ? "Processing..." : "Send to Cursor"}
          </span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer -translate-x-full" />
      </Button>
    </form>
  );
}
