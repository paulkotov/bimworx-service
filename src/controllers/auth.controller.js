import { getViewerToken } from '../services/apsAuth.js';

/**
 * GET /api/auth/token
 * Returns a viewer-scoped (`viewables:read`) APS token for the Autodesk Viewer.
 * Only the two fields the client needs are exposed.
 */
export const getToken = async (_req, res, next) => {
  try {
    const { access_token, expires_in } = await getViewerToken();
    res.json({ access_token, expires_in });
  } catch (err) {
    next(err);
  }
};
