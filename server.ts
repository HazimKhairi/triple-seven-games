/**
 * Standalone Socket.io server for Triple Seven multiplayer.
 * Runs independently of Next.js on port 3001.
 * Run with: tsx -r tsconfig-paths/register server.ts
 */
import { createServer } from 'http';
import { initSocketServer } from '@/server/ws-server';

const port = parseInt(process.env.WS_PORT || '3001', 10);

const httpServer = createServer();
initSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`> Triple Seven WebSocket server running on http://localhost:${port}`);
});
