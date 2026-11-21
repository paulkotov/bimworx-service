import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { hubsRouter } from './hubs.routes.js';
import { translateRouter } from './translate.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/hubs', hubsRouter);
apiRouter.use('/translate', translateRouter);
