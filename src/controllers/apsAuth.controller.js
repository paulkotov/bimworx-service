import {
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCode,
  toSessionTokens,
} from '../services/apsOAuth.js';
import { env } from '../config/env.js';
import { createHttpError } from '../utils/httpError.js';

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });

export const startApsLogin = async (req, res, next) => {
  try {
    const state = createOAuthState();
    req.session.oauthState = state;
    // Persist oauthState before the external Autodesk redirect.
    await saveSession(req);
    const url = buildAuthorizeUrl(state);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
};

export const handleApsCallback = async (req, res, next) => {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (error) {
      throw createHttpError(
        400,
        'Autodesk sign-in was denied or failed.',
        String(errorDescription || error),
      );
    }

    if (!code || typeof code !== 'string') {
      throw createHttpError(
        400,
        'Invalid Autodesk callback.',
        'Missing authorization code',
      );
    }

    if (!state || state !== req.session.oauthState) {
      throw createHttpError(
        400,
        'Invalid Autodesk callback state.',
        'OAuth state mismatch',
      );
    }

    delete req.session.oauthState;

    const token = await exchangeCode(code);
    req.session.aps = toSessionTokens(token);
    await saveSession(req);

    res.redirect(env.aps.authSuccessRedirect);
  } catch (err) {
    next(err);
  }
};

export const logoutAps = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie('bimworx.sid');
    // Browser navigations get a redirect; API clients get 204.
    if (req.accepts('html')) {
      res.redirect('/hubs');
      return;
    }
    res.status(204).end();
  });
};

export const getAuthMe = (req, res) => {
  const authenticated = Boolean(req.session?.aps?.accessToken);
  res.json({
    authenticated,
    user: authenticated ? { provider: 'autodesk' } : null,
  });
};
