import express from 'express';
import { apiRouter } from '../routes/index.js';
import { pageRouter } from '../routes/page.routes.js';
import { publicDir } from '../utils/paths.js';

/**
 * Mounts all HTTP routes onto the Express application.
 * Add new routers in src/routes/ and register them here.
 */
export const registerRoutes = (app) => {
  app.use('/api', apiRouter);
  app.use('/', pageRouter);
  // Serve static assets (app.js, styles.css) but let the EJS route own "/".
  app.use(express.static(publicDir, { index: false }));
};
