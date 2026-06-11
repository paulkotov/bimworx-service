import { env } from '../config/env.js';

let publicUrl = null;
let ngrokSession = null;

/**
 * Resolves the public-facing base URL for webhook callbacks.
 *
 * Order of resolution:
 *   1. `APS_WEBHOOK_URL` — preferred for production (no tunnel needed).
 *   2. `@ngrok/ngrok` — only if `APS_TUNNEL_ENABLED` is truthy.
 *   3. `null` — server starts but webhooks/DA features that need callbacks
 *      will be unavailable.
 */
export const startTunnel = async (port) => {
  if (env.webhooks.publicUrl) {
    publicUrl = env.webhooks.publicUrl.replace(/\/$/, '');
    return publicUrl;
  }

  if (!env.tunnel.enabled) return null;

  try {
    const ngrok = await import('@ngrok/ngrok');
    ngrokSession = await ngrok.forward({
      addr: port,
      authtoken: env.tunnel.authtoken ?? undefined,
      authtoken_from_env: !env.tunnel.authtoken,
    });
    publicUrl = ngrokSession.url();
    return publicUrl;
  } catch (error) {
    console.warn('[tunnel] failed to start ngrok:', error?.message ?? error);
    console.warn('[tunnel] webhook-dependent features will be disabled.');
    return null;
  }
};

export const getPublicUrl = () => publicUrl;

export const stopTunnel = async () => {
  if (ngrokSession?.close) {
    await ngrokSession.close().catch(() => {});
    ngrokSession = null;
  }
  publicUrl = null;
};
