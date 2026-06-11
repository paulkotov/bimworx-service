import { ModelDerivativeClient, View, Region } from '@aps_sdk/model-derivative';
import { env } from '../config/env.js';
import { getServerToken } from './autodesk.service.js';

const derivativesClient = new ModelDerivativeClient();

const resolveRegion = () => Region[env.aps.region] ?? Region.Us;

export const startTranslation = async (urn, { workflow } = {}) => {
  const accessToken = await getServerToken();
  const region = resolveRegion();

  const payload = {
    input: { urn },
    output: {
      formats: [
        {
          type: 'svf2',
          views: [View._2d, View._3d],
        },
      ],
    },
  };

  if (workflow ?? env.webhooks.workflowId) {
    payload.misc = { workflow: workflow ?? env.webhooks.workflowId };
  }

  return derivativesClient.startJob(payload, { region, accessToken, xAdsForce: true });
};

export const getManifest = async (urn) => {
  const accessToken = await getServerToken();
  return derivativesClient.getManifest(urn, {
    region: resolveRegion(),
    accessToken,
  });
};

export const getThumbnailBase64 = async (urn, { width = 200, height = 200 } = {}) => {
  const accessToken = await getServerToken();
  try {
    const result = await derivativesClient.getThumbnail(urn, {
      region: resolveRegion(),
      width,
      height,
      accessToken,
    });

    if (!result) return '';
    if (typeof result === 'string') return result;
    if (Buffer.isBuffer(result)) return result.toString('base64');
    if (result instanceof ArrayBuffer) return Buffer.from(result).toString('base64');
    return Buffer.from(result).toString('base64');
  } catch {
    return '';
  }
};
