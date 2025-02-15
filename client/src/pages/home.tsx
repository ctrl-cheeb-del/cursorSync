import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import PromptInput from "@/components/prompt-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (prompt: string) => {
    setIsSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/prompts", { content: prompt });
      const data = await res.json();
      setLocation(`/preview/${data.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit prompt",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <h1 className="text-2xl font-bold mb-4 text-foreground">
            Cursor IDE Companion
          </h1>
          <PromptInput onSubmit={handleSubmit} isLoading={isSubmitting} />
        </CardContent>
      </Card>
    </div>
  );
}
