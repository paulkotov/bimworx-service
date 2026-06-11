import { getViewerToken } from '../services/autodesk.service.js';

export const issueViewerToken = async (_req, res, next) => {
  try {
    const { accessToken, expiresIn } = await getViewerToken();
    res.json({
      access_token: accessToken,
      expires_in: expiresIn,
    });
  } catch (error) {
    next(error);
  }
};
