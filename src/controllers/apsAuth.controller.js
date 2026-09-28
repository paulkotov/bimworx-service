import {
  buildAuthorizeUrl,
  createOAuthState,
  exchangeCode,
  toSessionTokens,
} from '../services/apsOAuth.js';
import { env } from '../config/env.js';

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
      const err = new Error(String(errorDescription || error));
      err.status = 400;
      err.publicMessage = 'Autodesk sign-in was denied or failed.';
      throw err;
    }

    if (!code || typeof code !== 'string') {
      const err = new Error('Missing authorization code');
      err.status = 400;
      err.publicMessage = 'Invalid Autodesk callback.';
      throw err;
    }

    if (!state || state !== req.session.oauthState) {
      const err = new Error('OAuth state mismatch');
      err.status = 400;
      err.publicMessage = 'Invalid Autodesk callback state.';
      throw err;
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
