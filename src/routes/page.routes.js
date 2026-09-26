import { Router } from 'express';
import { renderHome, renderHubs, renderLogin } from '../controllers/page.controller.js';

export const pageRouter = Router();

pageRouter.get('/login', renderLogin);
pageRouter.get('/', renderHome);
pageRouter.get('/hubs', renderHubs);
