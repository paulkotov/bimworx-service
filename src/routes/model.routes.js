import { Router } from 'express';
import { getModel, triggerSync } from '../controllers/model.controller.js';

export const modelRouter = Router();

modelRouter.get('/', getModel);
modelRouter.post('/sync', triggerSync);
