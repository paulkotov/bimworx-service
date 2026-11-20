import { Router, raw } from 'express';
import { requireApsAuth } from '../middlewares/requireApsAuth.js';
import {
  getHubs,
  getHubProjects,
  getProject,
  getFolder,
  downloadItem,
  getItemDetails,
  createFolderUpload,
  uploadFolderPart,
  finishFolderUpload,
  deleteFolderItem,
} from '../controllers/hubs.controller.js';

export const hubsRouter = Router();

hubsRouter.use(requireApsAuth);
hubsRouter.get('/', getHubs);
hubsRouter.get('/:hubId/projects', getHubProjects);
hubsRouter.get('/:hubId/projects/:projectId', getProject);
hubsRouter.get('/:hubId/projects/:projectId/folders/:folderId', getFolder);
hubsRouter.get(
  '/:hubId/projects/:projectId/items/:itemId/details',
  getItemDetails,
);
hubsRouter.get(
  '/:hubId/projects/:projectId/items/:itemId/download',
  downloadItem,
);
// Multipart upload proxied through the server: the browser streams one part at
// a time (same-origin), the server PUTs it to the signed S3 URL. No whole-file
// buffering and no cross-origin dependency.
hubsRouter.post(
  '/:hubId/projects/:projectId/folders/:folderId/upload',
  createFolderUpload,
);
hubsRouter.put(
  '/:hubId/projects/:projectId/folders/:folderId/upload/part',
  raw({ type: '*/*', limit: '12mb' }),
  uploadFolderPart,
);
hubsRouter.post(
  '/:hubId/projects/:projectId/folders/:folderId/upload/complete',
  finishFolderUpload,
);
hubsRouter.delete(
  '/:hubId/projects/:projectId/items/:itemId',
  deleteFolderItem,
);
