import express from 'express';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { publicDir } from './utils/paths.js';

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.static(publicDir));
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
