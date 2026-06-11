import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { modelRouter } from './model.routes.js';
import { webhooksRouter } from './webhooks.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/model', modelRouter);
apiRouter.use('/webhooks', webhooksRouter);
