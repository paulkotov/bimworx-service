import express from 'express';
import { registerRoutes } from './registerRoutes.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { notFound } from '../middlewares/notFound.js';

export const createApp = () => {
  const app = express();

  app.use(express.json());
  registerRoutes(app);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
