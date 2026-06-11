import { env } from '../config/env.js';
import { getServerToken } from './autodesk.service.js';

const FORGE_BASE = 'https://developer.api.autodesk.com';
const HOOKS_PATH = '/webhooks/v1/systems/derivative/events/extraction.finished/hooks';

const authHeaders = async () => {
  const accessToken = await getServerToken();
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
};

const ensureOk = async (response, action) => {
  if (response.ok) return response;
  const body = await response.text().catch(() => '');
  throw new Error(`Webhook ${action} failed (${response.status} ${response.statusText}): ${body}`);
};

export const listExtractionHooks = async () => {
  const response = await fetch(`${FORGE_BASE}${HOOKS_PATH}`, {
    method: 'GET',
    headers: await authHeaders(),
  });
  await ensureOk(response, 'list');
  const json = await response.json();
  return json?.data ?? [];
};

export const createExtractionHook = async ({ callbackUrl, workflow, hookAttribute }) => {
  const body = {
    callbackUrl,
    scope: { workflow },
  };
  if (env.webhooks.sharedSecret) body.hookSecret = env.webhooks.sharedSecret;
  if (hookAttribute) body.hookAttribute = hookAttribute;

  const response = await fetch(`${FORGE_BASE}${HOOKS_PATH}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  await ensureOk(response, 'create');
  return response.status === 201;
};

export const deleteHook = async (hookPath) => {
  const url = `${FORGE_BASE}/webhooks/v1${hookPath}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (response.status === 204) return true;
  await ensureOk(response, 'delete');
  return true;
};

/**
 * Idempotently reconciles the extraction.finished webhook to a single hook
 * pointing at our callback URL for our workflow id. Stale hooks scoped to
 * the same workflow (e.g. from previous ngrok sessions) are deleted.
 */
export const reconcileExtractionWebhook = async (callbackUrl) => {
  const workflow = env.webhooks.workflowId;
  const hooks = await listExtractionHooks();

  let kept = false;
  for (const hook of hooks) {
    if (hook?.scope?.workflow !== workflow) continue;

    if (!kept && hook.callbackUrl === callbackUrl) {
      kept = true;
      continue;
    }

    const path = hook.__self__ ?? hook.hookId;
    if (path) {
      try {
        await deleteHook(path.startsWith('/') ? path : `/hooks/${path}`);
      } catch (error) {
        console.warn('[webhooks] failed to delete stale hook:', error.message);
      }
    }
  }

  if (!kept) {
    await createExtractionHook({ callbackUrl, workflow });
    return { created: true, workflow, callbackUrl };
  }

  return { created: false, workflow, callbackUrl };
};
