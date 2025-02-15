import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function FollowUpDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: FollowUpDialogProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt.trim());
      setPrompt("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Follow-up Prompt</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What else would you like to change?"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none"
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!prompt.trim() || isLoading}>
              {isLoading ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
