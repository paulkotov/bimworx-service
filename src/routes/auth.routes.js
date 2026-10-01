import { Router } from 'express';
import { requireApsAuth } from '../middlewares/requireApsAuth.js';
import { getToken, getApsUserToken } from '../controllers/auth.controller.js';
import {
  startApsLogin,
  handleApsCallback,
  logoutAps,
  getAuthMe,
} from '../controllers/apsAuth.controller.js';

export const authRouter = Router();

authRouter.get('/token', getToken);
authRouter.get('/aps/token', requireApsAuth, getApsUserToken);
authRouter.get('/aps/login', startApsLogin);
authRouter.get('/aps/callback', handleApsCallback);
authRouter.get('/aps/logout', logoutAps);
authRouter.get('/me', getAuthMe);
