import { Router } from 'express';
import { requireApsAuth } from '../middlewares/requireApsAuth.js';
import {
  createUpload,
  completeUpload,
  getStatus,
  getTranslationReport,
} from '../controllers/translate.controller.js';

export const translateRouter = Router();

// JSON body parsing (1 MiB limit) is configured globally in createApp.js.
translateRouter.use(requireApsAuth);
translateRouter.post('/uploads', createUpload);
translateRouter.post('/uploads/complete', completeUpload);
translateRouter.get('/reports', getTranslationReport);
translateRouter.get('/status', getStatus);
