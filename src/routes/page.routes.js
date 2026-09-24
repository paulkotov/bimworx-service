import { Router } from 'express';
import { renderHome } from '../controllers/page.controller.js';

export const pageRouter = Router();

pageRouter.get('/', renderHome);
