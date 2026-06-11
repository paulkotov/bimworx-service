import { Router } from 'express';
import { issueViewerToken } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.get('/token', issueViewerToken);
