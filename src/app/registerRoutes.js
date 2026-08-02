import express from 'express';
import { apiRouter } from '../routes/index.js';
import { publicDir } from '../utils/paths.js';

/**
 * Mounts all HTTP routes onto the Express application.
 * Add new routers in src/routes/ and register them here.
 */
export const registerRoutes = (app) => {
  app.use('/api', apiRouter);
  app.use(express.static(publicDir));
};
