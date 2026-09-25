import { Router } from 'express';
import { requireApsAuth } from '../middlewares/requireApsAuth.js';
import { getHubs, getHubProjects } from '../controllers/hubs.controller.js';

export const hubsRouter = Router();

hubsRouter.use(requireApsAuth);
hubsRouter.get('/', getHubs);
hubsRouter.get('/:hubId/projects', getHubProjects);
