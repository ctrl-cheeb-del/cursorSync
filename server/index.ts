import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { WebSocketServer, WebSocket as WS } from 'ws';
import { Server } from 'http';
import path from 'path';
import { execFile, ExecFileException } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { exitCode } from "process";
import { createInflateRaw } from "zlib";

// Import robotjs using dynamic import
let robot: any;
try {
  const robotModule = await import('robotjs');
  robot = robotModule.default;
} catch (error) {
  console.error('Failed to load robotjs:', error);
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create HTTP server
const server = new Server(app);

// Create WebSocket server on a different port
const WS_PORT = 3001;
const wss = new WebSocketServer({ 
  port: WS_PORT,
  clientTracking: true // Enable client tracking
});

// Track screenshot intervals for each connection
const screenshotIntervals = new Map<WS, NodeJS.Timeout>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Keyboard shortcuts for different OS
const SHORTCUTS = {
  openRaycast: { 
    mac: { key: 'space', modifiers: ['command'] },
    windows: { key: 'windows', modifiers: [''] }
  },
  commandPalette: { 
    mac: { key: 'p', modifiers: ['command', 'shift'] },
    windows: { key: 'p', modifiers: ['control', 'shift'] }
  },
};

// Detect operating system
const isMac = os.platform() === 'darwin';
const osType = isMac ? 'mac' : 'windows';

// Global state tracking
const globalState = {
  isCursorOpen: false,
  currentCommand: null as string | null,
  isProcessing: false,
  currentPromptId: null as number | null,
  lastScreenshotTime: null as number | null
};

async function typeString(text: string, charDelay: number = 20) {
  for (const char of text) {
    if (char === ' ') {
      robot.keyTap('space');
    } else {
      if (char.match(/[A-Z]/)) {
        robot.keyTap(char.toLowerCase(), ['shift']);
      } else {
        robot.keyTap(char.toLowerCase());
      }
    }
    await sleep(charDelay);
  }
}

async function captureAndSendScreenshot(ws: WS) {
  // Check if the WebSocket is still open before proceeding
  if (ws.readyState !== WS.OPEN) {
    console.log('WebSocket not open, skipping screenshot');
    if (screenshotIntervals.has(ws)) {
      clearInterval(screenshotIntervals.get(ws));
      screenshotIntervals.delete(ws);
    }
    return;
  }

  let tempFilePath: string | null = null;
  try {
    console.log('Starting screenshot capture...');
    tempFilePath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`);
    console.log('Temp file path:', tempFilePath);

    await new Promise<void>((resolve, reject) => {
      execFile('/usr/sbin/screencapture', ['-x', '-C', '-t', 'png', tempFilePath as string], (error: ExecFileException | null) => {
        if (error) {
          console.error('Screenshot capture failed:', error);
          reject(error);
          return;
        }
        console.log('Screenshot captured successfully');
        resolve();
      });
    });

    // Check again if the WebSocket is still open
    if (ws.readyState !== WS.OPEN) {
      console.log('WebSocket closed during screenshot capture, aborting send');
      return;
    }

    console.log('Reading screenshot file...');
    const screenshotData = await fs.promises.readFile(tempFilePath);
    console.log('Screenshot file size:', screenshotData.length, 'bytes');

    const header = Buffer.from(JSON.stringify({
      type: 'screenshot',
      timestamp: Date.now()
    }));

    const headerLengthBuffer = Buffer.alloc(4);
    headerLengthBuffer.writeUInt32BE(header.length);

    const finalBuffer = Buffer.concat([
      headerLengthBuffer,
      header,
      screenshotData
    ]);

    // Final check before sending
    if (ws.readyState === WS.OPEN) {
      console.log('Sending screenshot data, total size:', finalBuffer.length, 'bytes');
      ws.send(finalBuffer, { binary: true }, (error) => {
        if (error) {
          console.error('Error sending screenshot:', error);
          if (screenshotIntervals.has(ws)) {
            clearInterval(screenshotIntervals.get(ws));
            screenshotIntervals.delete(ws);
          }
        } else {
          console.log('Screenshot sent successfully');
        }
      });
    } else {
      console.log('WebSocket closed before sending, cleaning up interval');
      if (screenshotIntervals.has(ws)) {
        clearInterval(screenshotIntervals.get(ws));
        screenshotIntervals.delete(ws);
      }
    }

    // After successful screenshot send, update the timestamp
    globalState.lastScreenshotTime = Date.now();

  } catch (error) {
    console.error('Error capturing screenshot:', error);
    if (ws.readyState === WS.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to capture screenshot'
      }));
    }
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, (err) => {
        if (err) console.warn('Failed to delete temporary screenshot file:', err);
        else console.log('Temporary screenshot file deleted');
      });
    }
  }
}

async function automateCommand(message: string, ws: WS, isNewPrompt: boolean = true, promptId?: number) {
  try {
    if (isNewPrompt) {
      // If this prompt was already processed, just resume screenshots
      if (promptId && promptId === globalState.currentPromptId) {
        console.log('Prompt already processed, resuming screenshots');
        ws.send(JSON.stringify({ 
          type: 'status',
          status: 'success', 
          message: 'Command already executed, resuming updates' 
        }));

        // Send the last screenshot immediately if we have one
        if (globalState.lastScreenshotTime) {
          await captureAndSendScreenshot(ws);
        }

        // Set up screenshot interval
        if (screenshotIntervals.has(ws)) {
          clearInterval(screenshotIntervals.get(ws));
        }
        const interval = setInterval(async () => {
          await captureAndSendScreenshot(ws);
        }, 3000);
        screenshotIntervals.set(ws, interval);
        
        return true;
      }

      // If Cursor is already open and we're processing a different prompt
      if (globalState.isCursorOpen && globalState.isProcessing && globalState.currentPromptId !== promptId) {
        ws.send(JSON.stringify({ 
          type: 'status',
          status: 'error', 
          message: 'Another prompt is currently being processed' 
        }));
        return false;
      }

      // Update global state with new prompt
      globalState.currentCommand = message;
      globalState.isProcessing = true;
      globalState.currentPromptId = promptId || null;

      // Only open Raycast and Cursor if they're not already open
      if (!globalState.isCursorOpen) {
        ws.send(JSON.stringify({ 
          type: 'status',
          status: 'success', 
          message: 'Opening Cursor...' 
        }));
        console.log('Opening Cursor...');
        robot.keyTap(SHORTCUTS.openRaycast[osType].key, SHORTCUTS.openRaycast[osType].modifiers);
        await sleep(800);

        // Type 'cursor' and wait for it to load
        await typeString('cursor');
        await sleep(200);
        robot.keyTap('enter');
        await sleep(1500);

        globalState.isCursorOpen = true;
      }

      ws.send(JSON.stringify({ 
        type: 'status',
        status: 'success', 
        message: 'Opening composer...' 
      }));
      console.log('Opening composer...');
      
      // Open command palette and type composer.createNew
      const shortcut = SHORTCUTS.commandPalette[osType];
      robot.keyTap(shortcut.key, shortcut.modifiers);
      await sleep(500);
      await typeString('composer.createNew');
      await sleep(300);
      robot.keyTap('enter');
      await sleep(800);

      ws.send(JSON.stringify({ 
        type: 'status',
        status: 'success', 
        message: 'Typing message...' 
      }));
      console.log('Typing message...');
      await typeString(message, 15);
      await sleep(300);
    
      console.log('Sending message...');
      robot.keyTap('enter');
    } else {
      ws.send(JSON.stringify({ 
        type: 'status',
        status: 'success', 
        message: 'Typing message...' 
      }));
      await typeString(message, 15);
      await sleep(100);
      robot.keyTap('enter');
      await sleep(500);
    }

    if (screenshotIntervals.has(ws)) {
      clearInterval(screenshotIntervals.get(ws));
    }

    const interval = setInterval(async () => {
      await captureAndSendScreenshot(ws);
    }, 3000);

    screenshotIntervals.set(ws, interval);

    ws.send(JSON.stringify({ 
      type: 'status',
      status: 'success', 
      message: 'Command executed successfully' 
    }));
    
    return true;
  } catch (error) {
    console.error('Error during automation:', error);
    // Reset global state on error
    globalState.isProcessing = false;
    globalState.currentCommand = null;
    globalState.currentPromptId = null;
    globalState.lastScreenshotTime = null;
    ws.send(JSON.stringify({ 
      type: 'status',
      status: 'error', 
      message: `Failed to execute command: ${(error as Error).message}` 
    }));
    throw error;
  }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('New client connected');
  console.log('Total clients connected:', wss.clients.size);

  // If there's a command in progress, send the current status
  if (globalState.isProcessing && globalState.currentPromptId) {
    ws.send(JSON.stringify({ 
      type: 'status',
      status: 'success', 
      message: 'Command in progress',
      promptId: globalState.currentPromptId
    }));
  }

  // Set up ping-pong to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === WS.OPEN) {
      try {
        ws.ping();
        console.log('Ping sent');
      } catch (error) {
        console.error('Error sending ping:', error);
        clearInterval(pingInterval);
      }
    }
  }, 30000);

  ws.on('pong', () => {
    console.log('Client responded to ping');
  });

  // Track if a command is currently being executed
  let isExecutingCommand = false;

  ws.on('message', async (message) => {
    console.log('--- Received Message Start ---');
    console.log('Raw Message:', message.toString());
    
    if (ws.readyState !== WS.OPEN) {
      console.log('WebSocket not open, ignoring message');
      console.log('--- Received Message End (WebSocket Closed) ---');
      return;
    }

    try {
      let data;
      try {
        data = JSON.parse(message.toString());
        console.log('Parsed Message Data:', data);
      } catch (parseError) {
        console.error('Failed to parse message:', message.toString(), parseError);
        if (ws.readyState === WS.OPEN) {
          ws.send(JSON.stringify({
            type: 'status',
            status: 'error',
            message: 'Invalid message format. Please send JSON.'
          }));
        }
        console.log('--- Received Message End (Parse Error) ---');
        return;
      }

      if (!data.type) {
        console.error('Message missing type:', data);
        ws.send(JSON.stringify({
          type: 'status',
          status: 'error',
          message: 'Message must include a type'
        }));
        console.log('--- Received Message End (Missing Type) ---');
        return;
      }

      if (data.type === 'command') {
        // Extract promptId from the message
        const promptId = data.promptId as number;

        // Check if this prompt is already being processed
        if (promptId === globalState.currentPromptId) {
          console.log('Resuming existing prompt:', promptId);
          await automateCommand(data.message, ws, data.isNewPrompt, promptId);
          return;
        }

        // Check if a different prompt is being processed
        if (globalState.isProcessing && globalState.currentPromptId !== promptId) {
          console.log('Different prompt already in progress');
          ws.send(JSON.stringify({
            type: 'status',
            status: 'error',
            message: 'Another prompt is currently being processed'
          }));
          return;
        }

        try {
          isExecutingCommand = true;
          console.log('Executing command:', data.message, 'isNewPrompt:', data.isNewPrompt, 'promptId:', promptId);
          await automateCommand(data.message, ws, data.isNewPrompt, promptId);
        } finally {
          isExecutingCommand = false;
        }
      } else if (data.type === 'accept') {
        console.log('Accepting changes');
        // Reset global state when changes are accepted
        globalState.isProcessing = false;
        globalState.currentCommand = null;
        globalState.currentPromptId = null;
        globalState.lastScreenshotTime = null;
        if (screenshotIntervals.has(ws)) {
          clearInterval(screenshotIntervals.get(ws));
          screenshotIntervals.delete(ws);
        }
        robot.keyTap('enter', ['command']);
        ws.send(JSON.stringify({
          type: 'status',
          status: 'success',
          message: 'Response accepted'
        }));
      } else {
        console.error('Unknown message type:', data.type);
        ws.send(JSON.stringify({
          type: 'status',
          status: 'error',
          message: `Unknown message type: ${data.type}`
        }));
      }
      console.log('--- Received Message End (Success) ---');
    } catch (error) {
      console.error('Error processing message:', error);
      if (ws.readyState === WS.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'status',
          status: 'error', 
          message: `Server error: ${(error as Error).message}` 
        }));
      }
      console.log('--- Received Message End (Error) ---');
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clearInterval(pingInterval);
    if (screenshotIntervals.has(ws)) {
      clearInterval(screenshotIntervals.get(ws));
      screenshotIntervals.delete(ws);
    }
  });

  ws.on('close', (code, reason) => {
    console.log('Client disconnected with code:', code, 'reason:', reason.toString());
    console.log('Remaining clients:', wss.clients.size);
    clearInterval(pingInterval);
    if (screenshotIntervals.has(ws)) {
      clearInterval(screenshotIntervals.get(ws));
      screenshotIntervals.delete(ws);
    }
    
    // Only reset global state if there are no more clients connected
    if (wss.clients.size === 0) {
      globalState.isCursorOpen = false;
      globalState.isProcessing = false;
      globalState.currentCommand = null;
      globalState.currentPromptId = null;
      globalState.lastScreenshotTime = null;
    }
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const routes = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    log(`Server running at http://localhost:${PORT}`);
    log(`WebSocket server is ready on port ${WS_PORT}`);
  });
})();
