import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { modelStore } from '../store/model.store.js';

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
};

const isValidSignature = (rawSignature, rawBody) => {
  if (!env.webhooks.sharedSecret) return true;
  if (!rawSignature) return false;

  const expected = crypto
    .createHmac('sha1', env.webhooks.sharedSecret)
    .update(rawBody)
    .digest('hex');

  const provided = rawSignature.replace(/^sha1hashvalue=/, '');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
};

/**
 * Handles the APS `derivative.extraction.finished` webhook for our workflow id.
 * Flips the singleton model store from `translating` to `ready` (or `failed`).
 */
export const handleTranslationComplete = async (req, res, next) => {
  try {
    const signature = req.get('x-adsk-signature');
    if (!isValidSignature(signature, req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})))) {
      throw httpError(401, 'Invalid webhook signature.');
    }

    const urn = req.body?.payload?.URN ?? req.body?.resourceUrn;
    if (!urn) {
      throw httpError(400, 'Webhook payload is missing the URN.');
    }

    const snapshot = modelStore.snapshot();
    if (snapshot.urn !== urn) {
      console.warn('[webhooks] translation-complete for unknown urn:', urn);
      res.status(202).json({ accepted: false });
      return;
    }

    const status = req.body?.payload?.Payload?.status ?? req.body?.status ?? 'success';
    if (status === 'success') {
      modelStore.setReady(urn);
    } else {
      modelStore.fail(new Error(`Translation ${status}`));
    }

    res.status(200).json({ accepted: true });
  } catch (error) {
    next(error);
  }
};
