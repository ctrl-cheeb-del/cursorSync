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
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95 dark:from-background dark:to-background/95 p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-[300px] w-[300px] bg-purple-500/30 rounded-full blur-[128px] animate-pulse" />
        <div className="h-[300px] w-[300px] bg-blue-500/20 rounded-full blur-[128px] animate-pulse delay-300" />
      </div>

      <div className="relative w-full max-w-2xl mx-auto space-y-8 text-center">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-400 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            CursorSync
          </h1>
          <p className="text-xl text-muted-foreground/80 max-w-[600px] mx-auto animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-150">
            Seamlessly control Cursor with natural language. Type your request below to get started.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto backdrop-blur-sm bg-white/5 rounded-lg p-1 ring-1 ring-white/10 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
          <PromptInput onSubmit={handleSubmit} isLoading={isSubmitting} />
        </div>

        <div className="text-sm text-muted-foreground/60 animate-in fade-in slide-in-from-bottom-7 duration-1000 delay-500">
          Press <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">⌘</kbd> + <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded">Enter</kbd> to submit
        </div>
      </div>
    </div>
  );
}