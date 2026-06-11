import express, { Router } from 'express';
import { handleTranslationComplete } from '../controllers/webhooks.controller.js';

export const webhooksRouter = Router();

const rawJson = express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  },
});

webhooksRouter.post('/translation-complete', rawJson, handleTranslationComplete);
