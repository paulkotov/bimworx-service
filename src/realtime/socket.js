import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { modelStore } from '../store/model.store.js';

let io = null;

export const initSocket = (httpServer) => {
  if (io) return io;

  io = new Server(httpServer, {
    cors: {
      origin: env.realtime.corsOrigin === '*' ? true : env.realtime.corsOrigin,
      methods: ['GET'],
    },
  });

  io.on('connection', (socket) => {
    socket.emit('model:update', modelStore.snapshot());
  });

  modelStore.on('change', (snapshot) => {
    io?.emit('model:update', snapshot);
  });

  return io;
};

export const getIo = () => io;
