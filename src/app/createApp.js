import express from 'express';
import session from 'express-session';
import { registerRoutes } from './registerRoutes.js';
import { errorHandler } from '../middlewares/errorHandler.js';
import { notFound } from '../middlewares/notFound.js';
import { pageLocals } from '../middlewares/pageLocals.js';
import { viewsDir } from '../utils/paths.js';
import { env } from '../config/env.js';

export const createApp = () => {
  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', viewsDir);

  app.use(express.json());

  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  let sessionSecret = env.sessionSecret;
  if (!sessionSecret) {
    if (env.nodeEnv === 'production') {
      console.error(
        '[session] SESSION_SECRET is required in production; refusing to start.',
      );
      process.exit(1);
    }
    console.warn(
      '[session] SESSION_SECRET is not set; Autodesk login sessions will not work securely.',
    );
    sessionSecret = 'dev-insecure-session-secret';
  }

  app.use(
    session({
      name: 'bimworx.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.nodeEnv === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );

  app.use(pageLocals);
  registerRoutes(app);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
