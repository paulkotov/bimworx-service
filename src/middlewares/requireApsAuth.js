import {
  refreshAccessToken,
  toSessionTokens,
} from '../services/apsOAuth.js';

const REFRESH_SKEW_MS = 60_000;

const unauthorized = (res) =>
  res.status(401).json({ error: 'Autodesk sign-in required.' });

/**
 * Ensures a usable APS access token on the session.
 * @returns {Promise<string|null>} access token, or null if signed out / refresh failed
 */
export const ensureApsAccessToken = async (req) => {
  const aps = req.session?.aps;
  if (!aps?.accessToken) {
    return null;
  }

  const needsRefresh =
    !aps.expiresAt || aps.expiresAt - Date.now() < REFRESH_SKEW_MS;

  if (needsRefresh) {
    if (!aps.refreshToken) {
      delete req.session.aps;
      return null;
    }

    try {
      const token = await refreshAccessToken(aps.refreshToken);
      req.session.aps = {
        ...toSessionTokens(token),
        refreshToken: token.refresh_token ?? aps.refreshToken,
      };
    } catch {
      delete req.session.aps;
      return null;
    }
  }

  return req.session.aps.accessToken;
};

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
