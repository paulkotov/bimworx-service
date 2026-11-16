import { Router } from 'express';
import { requireApsPage } from '../middlewares/requireApsPage.js';
import {
  renderHome,
  renderHubs,
  renderLogin,
  renderProject,
  renderFolder,
  renderItemViewer,
  renderItemDetails,
  renderTranslate,
  renderTranslationReport,
  renderTranslationViewer,
} from '../controllers/page.controller.js';

export const pageRouter = Router();

// Public.
pageRouter.get('/login', renderLogin);

// Authenticated pages (redirect to /login when signed out).
pageRouter.get('/', requireApsPage, renderHome);
pageRouter.get('/translate/reports/view', requireApsPage, renderTranslationViewer);
pageRouter.get('/translate/reports', requireApsPage, renderTranslationReport);
pageRouter.get('/translate', requireApsPage, renderTranslate);
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
pageRouter.get(
  '/hubs/:hubId/projects/:projectId/items/:itemId/details',
  requireApsPage,
  renderItemDetails,
);
