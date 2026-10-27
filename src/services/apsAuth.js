import { AuthenticationClient, Scopes } from '@aps_sdk/authentication';
import { env } from '../config/env.js';
import { createHttpError, sanitizeApsError } from '../utils/httpError.js';

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
    throw createHttpError(
      503,
      'Viewer authentication is not configured.',
      'APS credentials are not configured',
    );
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
    // the `Authorization: Basic <clientId:secret>` credential. sanitizeApsError
    // keeps only the message, so credentials never reach the logger.
    throw sanitizeApsError(cause, 'Failed to obtain a viewer token from Autodesk.');
  }
};
