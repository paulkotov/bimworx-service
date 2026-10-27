import { Router, raw } from 'express';
import { requireApsAuth } from '../middlewares/requireApsAuth.js';
import {
  getHubs,
  getHubProjects,
  getProject,
  getFolder,
  downloadItem,
  uploadToFolder,
} from '../controllers/hubs.controller.js';

export const hubsRouter = Router();

hubsRouter.use(requireApsAuth);
hubsRouter.get('/', getHubs);
hubsRouter.get('/:hubId/projects', getHubProjects);
hubsRouter.get('/:hubId/projects/:projectId', getProject);
hubsRouter.get('/:hubId/projects/:projectId/folders/:folderId', getFolder);
hubsRouter.get(
  '/:hubId/projects/:projectId/items/:itemId/download',
  downloadItem,
);
// Raw body: the browser sends the file bytes directly (name is in the query).
hubsRouter.post(
  '/:hubId/projects/:projectId/folders/:folderId/upload',
  raw({ type: '*/*', limit: '500mb' }),
  uploadToFolder,
);
