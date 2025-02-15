import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ScreenshotPreview from "@/components/screenshot-preview";
import FollowUpDialog from "@/components/follow-up-dialog";
import { Button } from "@/components/ui/button";
import { Check, MessageSquarePlus } from "lucide-react";

export default function Preview() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: prompt, isLoading } = useQuery({
    queryKey: ["/api/prompts", id],
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PATCH", `/api/prompts/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompts", id] });
      if (status === "completed") {
        setLocation("/");
        toast({ title: "Changes applied successfully" });
      }
    },
  });

  const handleFollowUpSubmit = async (followUpPrompt: string) => {
    try {
      const res = await apiRequest("POST", "/api/prompts", { content: followUpPrompt });
      const data = await res.json();
      setLocation(`/preview/${data.id}`);
      setIsDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit follow-up prompt",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="pt-6">
            <Skeleton className="h-[200px] w-full mb-4" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Reviewing Changes
          </h2>
          <ScreenshotPreview />
          <div className="flex gap-4">
            <Button
              className="flex-1"
              onClick={() => updateStatus.mutate("completed")}
              disabled={updateStatus.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Accept Changes
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setIsDialogOpen(true)}
              disabled={updateStatus.isPending}
            >
              <MessageSquarePlus className="w-4 h-4 mr-2" />
              Prompt Further
            </Button>
          </div>
        </CardContent>
      </Card>

      <FollowUpDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleFollowUpSubmit}
        isLoading={false}
      />
    </div>
  );
}