import { ensureApsAccessToken } from '../services/apsSession.js';

/**
 * Page guard: redirects unauthenticated browser navigations to the login page
 * (the HTML counterpart of the API's requireApsAuth, which returns 401 JSON).
 * On success, attaches the access token as `req.apsAccessToken`.
 */
export const requireApsPage = async (req, res, next) => {
  try {
    const accessToken = await ensureApsAccessToken(req);
    if (!accessToken) {
      res.redirect('/login');
      return;
    }

    req.apsAccessToken = accessToken;
    next();
  } catch (err) {
    next(err);
  }
};
