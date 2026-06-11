import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { env } from '../config/env.js';

const authClient = new AuthenticationClient();

const TOKEN_REFRESH_BUFFER_MS = 60_000;
const tokenCache = new Map();

const cacheKey = (scopes) => [...scopes].sort().join(' ');

const fetchToken = async (scopes) => {
  const credentials = await authClient.getTwoLeggedToken(
    env.aps.clientId,
    env.aps.clientSecret,
    scopes
  );

  return {
    accessToken: credentials.access_token,
    expiresIn: credentials.expires_in,
    expiresAt: Date.now() + credentials.expires_in * 1000,
  };
};

export const getTwoLeggedToken = async (scopes) => {
  const key = cacheKey(scopes);
  const cached = tokenCache.get(key);

  if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return cached;
  }

  if (cached?.inflight) {
    return cached.inflight;
  }

  const inflight = fetchToken(scopes).finally(() => {
    const entry = tokenCache.get(key);
    if (entry?.inflight === inflight) {
      delete entry.inflight;
    }
  });

  tokenCache.set(key, { ...(cached ?? {}), inflight });

  const fresh = await inflight;
  tokenCache.set(key, fresh);
  return fresh;
};

export const PUBLIC_VIEWER_SCOPES = Object.freeze([Scopes.ViewablesRead]);

export const SERVER_SCOPES = Object.freeze([
  Scopes.DataRead,
  Scopes.DataWrite,
  Scopes.DataCreate,
  Scopes.BucketRead,
  Scopes.BucketCreate,
  Scopes.BucketUpdate,
  Scopes.BucketDelete,
  Scopes.ViewablesRead,
  Scopes.CodeAll,
]);

export const getViewerToken = async () => {
  const { accessToken, expiresIn } = await getTwoLeggedToken(PUBLIC_VIEWER_SCOPES);
  return { accessToken, expiresIn };
};

export const getServerToken = async () => {
  const { accessToken } = await getTwoLeggedToken(SERVER_SCOPES);
  return accessToken;
};
