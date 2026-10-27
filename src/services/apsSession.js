import { refreshAccessToken, toSessionTokens } from './apsOAuth.js';

const REFRESH_SKEW_MS = 60_000;

/**
 * Ensures a usable APS access token on the session, refreshing it when it is
 * missing or about to expire. This is the single source of truth for "is the
 * user authenticated and what is their token" — consumed by both the API guard
 * (requireApsAuth) and the page guard (requireApsPage).
 *
 * @param {import('express').Request} req
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
