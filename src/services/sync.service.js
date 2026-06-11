import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { modelStore } from '../store/model.store.js';
import { pickLatestFile, downloadFileBuffer } from './googleDrive.service.js';
import { buildObjectUrn, uploadObject } from './oss.service.js';
import { startTranslation, getManifest } from './derivatives.service.js';

let inflight = null;

const buildObjectName = (file) => {
  const ext = (file.name?.split('.').pop() ?? 'rvt').toLowerCase();
  const versionHash = crypto
    .createHash('sha1')
    .update(`${file.id}:${file.modifiedTime ?? ''}`)
    .digest('hex')
    .slice(0, 12);
  return `${file.id}_${versionHash}.${ext}`;
};

const isTerminalManifestStatus = (status) =>
  status === 'success' || status === 'failed' || status === 'timeout';

/**
 * Polls the Model Derivative manifest until the translation is complete or fails.
 * The translation-complete webhook will usually win this race in production —
 * the poller exists as a fallback when the public URL is unreachable.
 */
const pollManifestUntilDone = async (urn) => {
  const deadline = Date.now() + env.sync.manifestTimeoutMs;
  while (Date.now() < deadline) {
    if (modelStore.snapshot().status === 'ready') return; // webhook already flipped us
    try {
      const manifest = await getManifest(urn);
      modelStore.setProgress(manifest?.progress ?? null);
      if (manifest?.status === 'success') {
        modelStore.setReady(urn);
        return;
      }
      if (isTerminalManifestStatus(manifest?.status)) {
        throw new Error(`Translation ${manifest?.status}`);
      }
    } catch (error) {
      if (modelStore.snapshot().status === 'ready') return;
      console.warn('[sync] manifest poll error:', error?.message ?? error);
    }
    await new Promise((resolve) => setTimeout(resolve, env.sync.pollIntervalMs));
  }
  throw new Error(`Translation timed out after ${env.sync.manifestTimeoutMs}ms`);
};

/**
 * Idempotently ensures that the latest file in the configured Drive folder is
 * available as a translated SVF2 in the configured OSS bucket.
 *
 * Concurrent callers receive the same in-flight Promise.
 */
export const ensureLatestModel = async ({ force = false } = {}) => {
  if (inflight) return inflight;

  inflight = (async () => {
    const file = await pickLatestFile();
    if (!file) {
      modelStore.fail(new Error('Folder is empty or contains no supported files.'));
      throw new Error('No file found in the configured Google Drive folder.');
    }

    if (!force && modelStore.isUpToDate(file)) {
      return modelStore.snapshot();
    }

    modelStore.beginSync(file);

    try {
      modelStore.setStep('download');
      const { buffer } = await downloadFileBuffer(file.id);

      const objectName = buildObjectName(file);
      modelStore.setStep('upload');
      await uploadObject(objectName, buffer);

      const urn = buildObjectUrn(objectName);
      modelStore.setStep('translate');
      await startTranslation(urn);
      modelStore.setTranslating(urn, objectName, '0%');

      await pollManifestUntilDone(urn);
      return modelStore.snapshot();
    } catch (error) {
      modelStore.fail(error);
      throw error;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};

export const isSyncInFlight = () => Boolean(inflight);
