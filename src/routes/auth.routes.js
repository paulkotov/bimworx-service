import { Router } from 'express';
import { getToken } from '../controllers/auth.controller.js';

export const authRouter = Router();

authRouter.get('/token', getToken);
