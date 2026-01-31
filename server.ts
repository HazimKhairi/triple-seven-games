/**
 * Standalone Socket.io server for Triple Seven multiplayer.
 * Runs independently of Next.js on port 3001.
 * Run with: tsx -r tsconfig-paths/register server.ts
 */
import { createServer } from 'http';
import { initSocketServer } from '@/server/ws-server';

const port = parseInt(process.env.PORT || process.env.WS_PORT || '3001', 10);

const httpServer = createServer((req, res) => {
  // Health check endpoint for Render/Railway
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Triple Seven WebSocket Server is running');
  }
  // Explicitly ignore Socket.IO paths so the library can handle them
  else if (req.url?.startsWith('/api/socket')) {
    return;
  }
  // 404 for everything else
  else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

initSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`> Triple Seven WebSocket server running on http://localhost:${port}`);
});
