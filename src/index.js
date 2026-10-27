import http from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app/createApp.js';
import { env } from './config/env.js';

const app = createApp();
const server = http.createServer(app);

// Realtime channel. The APS analysis pipeline will emit `model:update`
// snapshots here as translation/analysis progresses.
const io = new SocketIOServer(server);
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

server.listen(env.port, () => {
  console.log(`Server listening on http://localhost:${env.port}`);
});
