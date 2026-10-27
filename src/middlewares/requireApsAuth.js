import { ensureApsAccessToken } from '../services/apsSession.js';

const unauthorized = (res) =>
  res.status(401).json({ error: 'Autodesk sign-in required.' });

/**
 * API guard: rejects unauthenticated requests with 401 JSON.
 * On success, attaches the access token as `req.apsAccessToken`.
 */
export const requireApsAuth = async (req, res, next) => {
  try {
    const accessToken = await ensureApsAccessToken(req);
    if (!accessToken) {
      unauthorized(res);
      return;
    }

    req.apsAccessToken = accessToken;
    next();
  } catch (err) {
    next(err);
  }
};
