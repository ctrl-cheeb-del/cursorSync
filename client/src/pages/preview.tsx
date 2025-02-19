import { useState, useEffect, useCallback } from "react";
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
import test from "node:test";

interface Prompt {
  id: number;
  content: string;
  status: "pending" | "processing" | "completed" | "rejected";
  timestamp: string;
}

interface WebSocketMessage {
  type: 'status' | 'screenshot';
  status?: 'success' | 'error';
  message?: string;
  timestamp?: number;
}

type ProgressStep = {
  label: string;
  status: 'pending' | 'current' | 'completed' | 'error';
};

export default function Preview() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState<string>();
  const [timestamp, setTimestamp] = useState<string>();
  const [steps, setSteps] = useState<ProgressStep[]>([
    { label: "Connecting to server", status: 'pending' },
    { label: "Opening Cursor", status: 'pending' },
    { label: "Opening composer", status: 'pending' },
    { label: "Typing prompt", status: 'pending' },
    { label: "Waiting for changes", status: 'pending' }
  ]);

  const updateStep = (index: number, status: ProgressStep['status']) => {
    setSteps(prev => prev.map((step, i) => {
      if (i === index) return { ...step, status };
      // Mark previous steps as completed when a step becomes current
      if (i < index && status === 'current') return { ...step, status: 'completed' };
      return step;
    }));
  };

  // Update steps based on WebSocket connection
  useEffect(() => {
    if (ws?.readyState === WebSocket.CONNECTING) {
      updateStep(0, 'current');
    } else if (ws?.readyState === WebSocket.OPEN) {
      updateStep(0, 'completed');
      updateStep(1, 'current');
    }
  }, [ws?.readyState]);

  const { data: prompt, isLoading } = useQuery<Prompt>({
    queryKey: ["/api/prompts", id],
    enabled: !!id,
    refetchOnWindowFocus: false,
    retry: false,
    select: (data) => {
      // Handle both single prompt and array of prompts
      if (Array.isArray(data)) {
        const found = data.find(p => p.id === Number(id));
        if (!found) {
          throw new Error("Prompt not found");
        }
        return found;
      }
      return data;
    }
  });

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      console.log('Received ArrayBuffer data of size:', event.data.byteLength);
      try {
        const dataView = new DataView(event.data);
        const headerLength = dataView.getUint32(0);
        console.log('Header length:', headerLength);
        
        const headerText = new TextDecoder().decode(new Uint8Array(event.data, 4, headerLength));
        console.log('Header:', headerText);
        const header = JSON.parse(headerText) as WebSocketMessage;
        
        if (header.type === 'screenshot') {
          console.log('Processing screenshot data');
          const imageData = new Uint8Array(event.data, 4 + headerLength);
          console.log('Image data size:', imageData.length);
          
          const blob = new Blob([imageData], { type: 'image/png' });
          const imageUrl = URL.createObjectURL(blob);
          console.log('Created blob URL:', imageUrl);
          
          setScreenshotUrl((prevUrl) => {
            if (prevUrl) {
              console.log('Revoking previous URL:', prevUrl);
              URL.revokeObjectURL(prevUrl);
            }
            return imageUrl;
          });
          
          setTimestamp(header.timestamp?.toString());
          console.log('Screenshot processed successfully');
          
          // Update steps when screenshot is received
          updateStep(4, 'current');
        }
      } catch (error) {
        console.error('Error processing binary message:', error);
      }
    } else {
      try {
        const response = JSON.parse(event.data) as WebSocketMessage;
        console.log('Received text message:', response);
        if (response.type === 'status') {
          if (response.status === 'error' && response.message) {
            console.error('Error message received:', response.message);
            toast({
              title: "Error",
              description: response.message,
              variant: "destructive",
            });
            // Update steps on error
            steps.forEach((_, index) => updateStep(index, 'error'));
          } else if (response.message) {
            // Handle different status messages
            switch (response.message) {
              case 'Opening Cursor...':
                updateStep(1, 'current');
                break;
              case 'Opening composer...':
                updateStep(2, 'current');
                break;
              case 'Typing message...':
                updateStep(3, 'current');
                break;
              case 'Command executed successfully':
                // Mark all steps up to waiting for changes as completed
                for (let i = 0; i < 4; i++) {
                  updateStep(i, 'completed');
                }
                updateStep(4, 'current');
                break;
            }
          }
        }
      } catch (error) {
        console.error('Error parsing text message:', error);
      }
    }
  }, [toast]);

  // WebSocket connection effect
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Max reconnection attempts reached');
        toast({
          title: "Connection Error",
          description: "Failed to maintain connection to server",
          variant: "destructive",
        });
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:3001`;
      console.log('Connecting to WebSocket:', wsUrl);
      
      socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        console.log('WebSocket connected');
        setWs(socket);
        reconnectAttempts = 0;
      };

      socket.onmessage = handleWebSocketMessage;

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setWs(null);
        
        if (event.code !== 1000) {
          console.log('Attempting to reconnect...');
          reconnectAttempts++;
          reconnectTimeout = setTimeout(connectWebSocket, 2000);
        }
      };
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      if (socket) {
        socket.close(1000, 'Component unmounting');
      }
    };
  }, [handleWebSocketMessage, toast]);

  // Send initial prompt when WebSocket is connected and prompt data is available
  useEffect(() => {
    if (ws?.readyState === WebSocket.OPEN && prompt?.content && prompt.status === 'pending') {
      console.log('Sending initial prompt:', prompt.content);
      try {
        ws.send(JSON.stringify({
          type: 'command',
          message: prompt.content,
          isNewPrompt: true,
          promptId: prompt.id
        }));
      } catch (error) {
        console.error('Error sending prompt:', error);
        toast({
          title: "Error",
          description: "Failed to send prompt to server",
          variant: "destructive",
        });
      }
    }
  }, [ws?.readyState, prompt?.content, prompt?.status, prompt?.id, toast]);

  // Debug render with more details
  console.log('Render state:', { 
    screenshotUrl, 
    timestamp, 
    isLoading, 
    promptData: prompt,
    wsState: ws ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState] : 'null',
    promptContent: prompt?.content,
    promptId: id,
    promptFound: !!prompt
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      if (ws) {
        if (status === 'completed') {
          ws.send(JSON.stringify({ type: 'accept' }));
        }
      }
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
      if (ws) {
        ws.send(JSON.stringify({
          type: 'command',
          message: followUpPrompt,
          isNewPrompt: false,
          promptId: prompt?.id
        }));
      }
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

  if (!prompt) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Prompt not found
            </h2>
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
          <ScreenshotPreview 
            imageUrl={screenshotUrl} 
            timestamp={timestamp}
            steps={steps}
          />
          <div className="flex flex-col md:flex-row gap-3 mt-4">
            <Button
              className="w-full border-2 border-white text-white bg-transparent hover:bg-white/10"
              onClick={() => updateStatus.mutate("completed")}
              disabled={updateStatus.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Accept Changes
            </Button>
            <Button
              variant="secondary"
              className="w-full"
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