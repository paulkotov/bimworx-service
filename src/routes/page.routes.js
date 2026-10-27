import { Router } from 'express';
import { requireApsPage } from '../middlewares/requireApsPage.js';
import {
  renderHome,
  renderHubs,
  renderLogin,
  renderProject,
  renderFolder,
  renderItemViewer,
} from '../controllers/page.controller.js';

export const pageRouter = Router();

// Public.
pageRouter.get('/login', renderLogin);

// Authenticated pages (redirect to /login when signed out).
pageRouter.get('/', requireApsPage, renderHome);
pageRouter.get('/hubs', requireApsPage, renderHubs);
pageRouter.get(
  '/hubs/:hubId/projects/:projectId',
  requireApsPage,
  renderProject,
);
pageRouter.get(
  '/hubs/:hubId/projects/:projectId/folders/:folderId',
  requireApsPage,
  renderFolder,
);
pageRouter.get(
  '/hubs/:hubId/projects/:projectId/items/:itemId/view',
  requireApsPage,
  renderItemViewer,
);
