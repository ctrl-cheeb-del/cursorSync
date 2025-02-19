# CursorSync

CursorSync is a tool that allows you to control [Cursor](https://cursor.sh) from any device on your network. It provides a modern web interface to send prompts to Cursor, preview the changes in real-time, and accept or refine the suggestions.

## Features

- 🌐 Control Cursor from any device on your network
- 🔄 Real-time preview of changes via screenshots
- ⚡️ Seamless prompt submission and refinement
- 🎨 Modern, sleek interface
- 🔒 Local network only for security

## Prerequisites

- Node.js 16+ or Bun
- [Cursor](https://cursor.sh) installed on the host machine
- macOS (Windows support coming soon)

## Setup

1. Clone the repository:
```bash
git clone https://github.com/ctrl-cheeb-del/cursorSync
cd CursorSync
```

2. Install dependencies:
```bash
# Using npm
npm install

# Using Bun
bun install
```

3. Start the development server:
```bash
# Using npm
npm run dev

# Using Bun
bun run dev
```

The server will start on port 3000, and the WebSocket server on port 3001.

## Usage

1. Start CursorSync on your main machine (where Cursor is installed)

2. Access the web interface from any device on your network:
   ```
   http://<host-machine-ip>:3000
   ```
   Replace `<host-machine-ip>` with your host machine's local IP address 

3. Enter your prompt in the text area and click "Send to Cursor" or press ⌘+Enter

4. View the real-time changes through screenshots

5. Either:
   - Accept the changes by clicking "Accept"
   - Send a follow-up prompt to refine the changes
   - Start a new prompt

## Development

The project consists of:
- `client/`: React frontend with TypeScript
- `server/`: Express backend handling WebSocket connections and system automation

## Security Note

CursorSync is designed to run on your local network only. It does not include authentication as it's meant for personal use in trusted environments.
However authentication and hosting will be coming soon.



