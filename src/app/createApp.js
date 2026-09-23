import express from 'express';
import { registerRoutes } from './registerRoutes.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { notFound } from '../middlewares/notFound.js';
import { viewsDir } from '../utils/paths.js';

export const createApp = () => {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', viewsDir);

  app.use(express.json());
  registerRoutes(app);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
