import { OssClient, Region, Access } from '@aps_sdk/oss';
import { env } from '../config/env.js';
import { getServerToken } from './autodesk.service.js';

const ossClient = new OssClient();

const resolveRegion = () => Region[env.aps.region] ?? Region.Us;

export const encodeUrn = (objectId) =>
  Buffer.from(objectId, 'utf8').toString('base64url');

export const buildObjectId = (objectName) =>
  `urn:adsk.objects:os.object:${env.aps.bucketKey}/${objectName}`;

export const buildObjectUrn = (objectName) =>
  encodeUrn(buildObjectId(objectName));

export const decodeObjectName = (urn) => {
  const decoded = Buffer.from(urn, 'base64url').toString('utf8');
  const prefix = `urn:adsk.objects:os.object:${env.aps.bucketKey}/`;
  return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : null;
};

export const ensureBucket = async () => {
  const accessToken = await getServerToken();
  const bucketKey = env.aps.bucketKey;

  try {
    await ossClient.getBucketDetails(bucketKey, { accessToken });
    return { bucketKey, created: false };
  } catch (error) {
    const status = typeof error?.httpStatusCode === 'function'
      ? error.httpStatusCode()
      : error?.axiosError?.response?.status;
    if (status !== 404) {
      throw error;
    }
  }

  await ossClient.createBucket(
    resolveRegion(),
    { bucketKey, policyKey: env.aps.bucketPolicy },
    { accessToken }
  );
  return { bucketKey, created: true };
};

export const createEmptyObject = async (objectName) => {
  const accessToken = await getServerToken();
  return ossClient.uploadObject(
    env.aps.bucketKey,
    objectName,
    Buffer.alloc(0),
    { accessToken }
  );
};

export const uploadObject = async (objectName, source) => {
  const accessToken = await getServerToken();
  return ossClient.uploadObject(env.aps.bucketKey, objectName, source, { accessToken });
};

const ACCESS_MAP = {
  read: Access.Read,
  write: Access.Write,
  readwrite: Access.ReadWrite,
};

export const createSignedUrl = async (objectName, accessLevel = 'read', minutesExpiration) => {
  const accessToken = await getServerToken();
  const access = ACCESS_MAP[accessLevel] ?? Access.Read;

  const response = await ossClient.createSignedResource(
    env.aps.bucketKey,
    objectName,
    {
      access,
      accessToken,
      createSignedResource: minutesExpiration ? { minutesExpiration } : undefined,
    }
  );

  return {
    signedUrl: response.signedUrl,
    expiration: response.expiration,
  };
};

export const deleteObject = async (objectName) => {
  const accessToken = await getServerToken();
  return ossClient.deleteObject(env.aps.bucketKey, objectName, { accessToken });
};
