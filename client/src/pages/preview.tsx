import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ScreenshotPreview from "@/components/screenshot-preview";
import ActionButtons from "@/components/action-buttons";

export default function Preview() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

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
          <ActionButtons
            onAccept={() => updateStatus.mutate("completed")}
            onReject={() => updateStatus.mutate("rejected")}
            isLoading={updateStatus.isPending}
          />
        </CardContent>
      </Card>
    </div>
  );
}
