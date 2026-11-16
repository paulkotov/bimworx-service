import { randomUUID } from 'node:crypto';
import { PolicyKey, Region } from '@aps_sdk/oss';
import { createHttpError, sanitizeApsError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { ossClient, derivativeClient } from './apsClients.js';
import { getInternalToken } from './apsAuth.js';
import { translationState } from './modelDetailsMap.js';

export const PART_SIZE = 10 * 1024 * 1024; // 10 MiB (S3 parts must be >= 5 MiB)
const MAX_PARTS = 10_000;

/** Base64URL-encodes an OSS objectId into a Model Derivative / Viewer URN. */
export const encodeUrn = (objectId) =>
  Buffer.from(objectId, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const OBJECT_URN_RE = /^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/;

/** Decodes a viewer URN into an OSS object id, or returns null when it is not one. */
export const decodeObjectUrn = (urn) => {
  if (typeof urn !== 'string' || !urn.trim()) return null;
  const decoded = Buffer.from(urn.trim(), 'base64url').toString('utf8');
  const match = OBJECT_URN_RE.exec(decoded);
  if (!match) return null;
  return { bucketKey: match[1], objectKey: match[2], objectId: decoded };
};

/**
 * Accepts only a viewer URN for an object in this app's translation bucket.
 * Throws 400 for anything else and 503 when the bucket is not configured.
 */
export const assertOwnObjectUrn = (urn) => {
  const decoded = decodeObjectUrn(urn);
  if (!decoded) {
    throw createHttpError(
      400,
      'A translation URN from this app is required.',
      'URN is not an OSS object',
    );
  }
  const bucketKey = requireBucketKey();
  if (decoded.bucketKey !== bucketKey) {
    throw createHttpError(
      400,
      'A translation URN from this app is required.',
      'URN is not an object in the translation bucket',
    );
  }
  return urn.trim();
};

/** Validates the top-level Revit file name; returns it trimmed or throws 400. */
export const assertRootFilename = (name) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed || !/\.rvt$/i.test(trimmed) || /[\\/]/.test(trimmed)) {
    throw createHttpError(400, 'A root .rvt file name is required.', `Invalid rootFilename: ${String(name)}`);
  }
  return trimmed;
};

/** Number of multipart chunks for a known file size; throws 400 on bad input. */
export const planParts = (size, partSize = PART_SIZE) => {
  if (!Number.isInteger(size) || size <= 0) {
    throw createHttpError(400, 'A positive file size is required.', `Invalid size: ${String(size)}`);
  }
  const parts = Math.ceil(size / partSize);
  if (parts > MAX_PARTS) {
    throw createHttpError(400, 'The archive is too large to upload.', `parts ${parts} > ${MAX_PARTS}`);
  }
  return parts;
};

/** Builds the Model Derivative startJob payload for a compressed (zip) source. */
export const buildTranslationJobPayload = (urn, rootFilename) => ({
  input: { urn, compressedUrn: true, rootFilename },
  output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] },
});

const apsHttpStatus = (cause) =>
  (typeof cause?.httpStatusCode === 'function' ? Number(cause.httpStatusCode()) : null) ||
  cause?.axiosError?.response?.status ||
  cause?.response?.status ||
  null;

/** True when the APS error is a 409 (bucket already exists). */
export const isBucketConflict = (cause) => apsHttpStatus(cause) === 409;

const KNOWN_REGIONS = new Set(Object.values(Region));

/** Resolves the configured region to a valid OSS/MD region (defaults to US). */
const resolveRegion = () => {
  const value = String(env.aps.region ?? 'US').trim().toUpperCase();
  return KNOWN_REGIONS.has(value) ? value : Region.Us;
};

/** Returns the configured translation bucket key or throws a 503. */
const requireBucketKey = () => {
  const bucketKey = env.aps.bucketKey;
  if (!bucketKey) {
    throw createHttpError(503, 'Translation storage is not configured.', 'APS_BUCKET_KEY is not set');
  }
  return bucketKey;
};

/** Ensures the app's translation bucket exists (persistent); returns its key. */
const ensureBucket = async (accessToken) => {
  const bucketKey = requireBucketKey();
  try {
    await ossClient.getBucketDetails(bucketKey, { accessToken });
    return bucketKey;
  } catch (cause) {
    if (apsHttpStatus(cause) !== 404) {
      throw sanitizeApsError(cause, 'Failed to access translation storage.');
    }
  }
  try {
    await ossClient.createBucket(
      resolveRegion(),
      { bucketKey, policyKey: PolicyKey.Persistent },
      { accessToken },
    );
  } catch (cause) {
    if (!isBucketConflict(cause)) {
      throw sanitizeApsError(cause, 'Failed to create translation storage.');
    }
  }
  return bucketKey;
};

/**
 * Starts a direct-to-S3 multipart upload for a composite ZIP of known size.
 * @returns signed part URLs plus the keys the browser echoes back on complete.
 */
export const createUploadSession = async ({ rootFilename, size }) => {
  const root = assertRootFilename(rootFilename);
  const parts = planParts(size);
  const accessToken = await getInternalToken();
  const bucketKey = await ensureBucket(accessToken);
  const objectKey = `${randomUUID()}.zip`;

  let session;
  try {
    // Default signed-URL expiry is 2 minutes, far too short for a large
    // multi-part ZIP uploaded sequentially from the browser; widen to 60 min.
    session = await ossClient.signedS3Upload(bucketKey, objectKey, {
      parts,
      minutesExpiration: 60,
      accessToken,
    });
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to start the upload.');
  }

  return {
    objectKey,
    uploadKey: session.uploadKey,
    urls: session.urls,
    partSize: PART_SIZE,
    rootFilename: root,
  };
};

/**
 * Finalizes the S3 object and starts an SVF2 translation of the composite ZIP.
 * @returns the viewer URN and an initial status.
 */
export const finalizeTranslation = async ({ objectKey, uploadKey, size, eTags, rootFilename }) => {
  const root = assertRootFilename(rootFilename);
  if (!objectKey || !uploadKey) {
    throw createHttpError(400, 'Upload session details are missing.', 'missing objectKey/uploadKey');
  }
  if (!Array.isArray(eTags) || eTags.length === 0) {
    throw createHttpError(400, 'Uploaded parts are missing.', 'missing eTags');
  }
  if (!Number.isInteger(size) || size <= 0) {
    throw createHttpError(400, 'A positive file size is required.', 'invalid size');
  }

  const bucketKey = requireBucketKey();
  const accessToken = await getInternalToken();

  try {
    await ossClient.completeSignedS3Upload(
      bucketKey,
      objectKey,
      'application/json',
      { uploadKey, size, eTags },
      { accessToken },
    );
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to finalize the upload.');
  }

  const urn = encodeUrn(`urn:adsk.objects:os.object:${bucketKey}/${objectKey}`);

  try {
    await derivativeClient.startJob(
      buildTranslationJobPayload(urn, root),
      { accessToken, region: resolveRegion() },
    );
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to start translation.');
  }

  return { urn, status: 'inprogress' };
};

/** Reads the translation status of a previously started job. */
export const getTranslationStatus = async (urn) => {
  if (!urn) {
    throw createHttpError(400, 'A model URN is required.', 'missing urn');
  }
  const accessToken = await getInternalToken();
  try {
    const manifest = await derivativeClient.getManifest(urn, { accessToken, region: resolveRegion() });
    return { urn, status: translationState(manifest) };
  } catch (cause) {
    if (apsHttpStatus(cause) === 404) return { urn, status: 'missing' };
    throw sanitizeApsError(cause, 'Failed to read translation status.');
  }
};
