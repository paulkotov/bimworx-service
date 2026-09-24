import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { env } from '../config/env.js';

const authClient = new AuthenticationClient();

/**
 * Mints a 2-legged APS token scoped ONLY to `viewables:read`.
 * This is the token handed to the browser-side Autodesk Viewer — it must never
 * carry write/bucket scopes (see the reference repo's anti-pattern of returning
 * a full-scope token to the client).
 *
 * @returns {Promise<{ access_token: string, expires_in: number }>}
 */
export const getViewerToken = async () => {
  const { clientId, clientSecret } = env.aps;

  if (!clientId || !clientSecret) {
    const err = new Error('APS credentials are not configured');
    err.status = 503;
    err.publicMessage = 'Viewer authentication is not configured.';
    throw err;
  }

  try {
    const { access_token, expires_in } = await authClient.getTwoLeggedToken(
      clientId,
      clientSecret,
      [Scopes.ViewablesRead],
    );

    return { access_token, expires_in };
  } catch (cause) {
    // The APS SDK error carries an axios request object whose headers include
    // the `Authorization: Basic <clientId:secret>` credential. Never let it
    // propagate to the logger — rethrow a sanitized, credential-free error.
    const err = new Error(cause?.message ?? 'APS token request failed');
    err.status = 502;
    err.publicMessage = 'Failed to obtain a viewer token from Autodesk.';
    throw err;
  }
};
