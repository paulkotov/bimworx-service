import { getViewerToken } from '../services/apsAuth.js';

/**
 * GET /api/auth/token
 * Returns a 2-legged viewer-scoped (`viewables:read`) APS token.
 * Kept for generic viewer use; ACC / BIM 360 models use getApsUserToken instead.
 */
export const getToken = async (_req, res, next) => {
  try {
    const { access_token, expires_in } = await getViewerToken();
    res.json({ access_token, expires_in });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/aps/token
 * Returns the signed-in user's 3-legged access token for the Autodesk Viewer
 * when loading ACC / BIM 360 models. Requires requireApsAuth.
 */
export const getApsUserToken = (req, res) => {
  const expiresAt = req.session?.aps?.expiresAt;
  const expiresIn = expiresAt
    ? Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
    : 3600;

  res.json({
    access_token: req.apsAccessToken,
    expires_in: expiresIn,
  });
};
