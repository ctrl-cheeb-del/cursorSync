import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import PromptInput from "@/components/prompt-input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface WebSocketMessage {
  type: 'status';
  status: 'success' | 'error';
  message: string;
}

export default function Home() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [ws, setWs] = useState<WebSocket | null>(null);

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    const response = JSON.parse(event.data) as WebSocketMessage;
    if (response.type === 'status' && response.status === 'error') {
      toast({
        title: "Error",
        description: response.message,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:3001`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    socket.onmessage = handleWebSocketMessage;

    socket.onclose = () => {
      console.log('Disconnected from WebSocket server');
      setWs(null);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [handleWebSocketMessage]);

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
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-xl font-medium text-muted-foreground text-center">
          What would you like to change?
        </h1>
        <PromptInput onSubmit={handleSubmit} isLoading={isSubmitting} />
      </div>
    </div>
  );
}