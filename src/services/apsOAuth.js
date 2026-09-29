import {
  AuthenticationClient,
  ResponseType,
  Scopes,
} from '@aps_sdk/authentication';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const authClient = new AuthenticationClient();

const THREE_LEGGED_SCOPES = [
  Scopes.DataRead,
  Scopes.OpenId,
  Scopes.UserProfileRead,
];

export const createOAuthState = () => randomBytes(24).toString('hex');

export const assertApsCredentials = () => {
  const { clientId, clientSecret } = env.aps;
  if (!clientId || !clientSecret) {
    const err = new Error('APS credentials are not configured');
    err.status = 503;
    err.publicMessage = 'Autodesk authentication is not configured.';
    throw err;
  }
};

const sanitizeApsError = (cause, publicMessage) => {
  const err = new Error(cause?.message ?? 'APS request failed');
  err.status = 502;
  err.publicMessage = publicMessage;
  return err;
};

export const buildAuthorizeUrl = (state) => {
  assertApsCredentials();
  return authClient.authorize(
    env.aps.clientId,
    ResponseType.Code,
    env.aps.callbackUrl,
    THREE_LEGGED_SCOPES,
    { state },
  );
};

export const exchangeCode = async (code) => {
  assertApsCredentials();
  try {
    return await authClient.getThreeLeggedToken(
      env.aps.clientId,
      code,
      env.aps.callbackUrl,
      { clientSecret: env.aps.clientSecret },
    );
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to complete Autodesk sign-in.');
  }
};

export const refreshAccessToken = async (refreshToken) => {
  assertApsCredentials();
  try {
    return await authClient.refreshToken(refreshToken, env.aps.clientId, {
      clientSecret: env.aps.clientSecret,
      scopes: THREE_LEGGED_SCOPES,
    });
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to refresh Autodesk session.');
  }
};

export const toSessionTokens = (token) => ({
  accessToken: token.access_token,
  refreshToken: token.refresh_token ?? null,
  expiresAt: Date.now() + Number(token.expires_in ?? 3600) * 1000,
});
