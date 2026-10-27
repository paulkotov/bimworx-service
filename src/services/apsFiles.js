import { dataClient, ossClient } from './apsClients.js';
import { listFolderContents } from './apsData.js';
import { createHttpError, sanitizeApsError } from '../utils/httpError.js';

const STORAGE_URN_RE = /^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/;

/** Base64URL-encodes a version id for Autodesk Viewer / Model Derivative. */
const toViewerUrn = (versionId) =>
  Buffer.from(versionId, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

export const isRevitFileName = (fileName) =>
  typeof fileName === 'string' && /\.rvt$/i.test(fileName);

const BIM360_ITEM_EXT = { type: 'items:autodesk.bim360:File', version: '1.0' };
const BIM360_VERSION_EXT = {
  type: 'versions:autodesk.bim360:File',
  version: '1.0',
};

/** Splits an OSS storage URN into { bucketKey, objectKey }, or null. */
const parseStorageUrn = (storageId) => {
  const match = storageId ? STORAGE_URN_RE.exec(storageId) : null;
  return match ? { bucketKey: match[1], objectKey: match[2] } : null;
};

/**
 * Resolves the tip version of a Revit (.rvt) item into a Viewer URN.
 * @returns {Promise<{ urn: string, fileName: string, versionId: string }>}
 */
export const getItemViewInfo = async (projectId, itemId, accessToken) => {
  let version;
  try {
    const resp = await dataClient.getItemTip(projectId, itemId, {
      accessToken,
    });
    version = resp.data;
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to resolve the model version.');
  }

  const fileName =
    version?.attributes?.displayName ?? version?.attributes?.name ?? null;
  const versionId = version?.id;

  if (!versionId || !fileName) {
    throw createHttpError(404, 'This item has no viewable version.');
  }
  if (!isRevitFileName(fileName)) {
    throw createHttpError(400, 'Only Revit (.rvt) files can be opened in the viewer.');
  }

  return {
    urn: toViewerUrn(versionId),
    fileName,
    versionId,
  };
};

/**
 * Resolves a temporary, signed download URL for the tip (latest) version of an
 * item, provided the current user has access. Throws a sanitized error when the
 * item is not downloadable or access is denied.
 * @returns {Promise<{ url: string, fileName: string }>}
 */
export const getItemDownloadInfo = async (projectId, itemId, accessToken) => {
  let version;
  try {
    const resp = await dataClient.getItemTip(projectId, itemId, {
      accessToken,
    });
    version = resp.data;
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to resolve the file version.');
  }

  const storageId = version?.relationships?.storage?.data?.id;
  const fileName =
    version?.attributes?.displayName ?? version?.attributes?.name ?? 'download';

  const parsed = parseStorageUrn(storageId);
  if (!parsed) {
    throw createHttpError(404, 'This item has no downloadable file.');
  }

  // Ask S3 to return the original file name (and force a download) instead of
  // naming the file after the opaque OSS object key.
  const safeName = fileName.replace(/["\\]/g, '');
  const contentDisposition =
    `attachment; filename="${safeName}"; ` +
    `filename*=UTF-8''${encodeURIComponent(fileName)}`;

  let signed;
  try {
    signed = await ossClient.signedS3Download(parsed.bucketKey, parsed.objectKey, {
      accessToken,
      responseContentDisposition: contentDisposition,
    });
  } catch (cause) {
    throw sanitizeApsError(cause, 'You do not have access to download this file.');
  }

  const url = signed?.url ?? signed?.urls?.[0];
  if (!url) {
    throw createHttpError(
      404,
      'This file is too large for direct download. Open it in Autodesk Docs instead.',
    );
  }

  return { url, fileName };
};

/** Allocates an OSS storage location targeted at a folder. */
const createFolderStorage = async (projectId, folderId, fileName, accessToken) => {
  try {
    const storage = await dataClient.createStorage(
      projectId,
      {
        jsonapi: { version: '1.0' },
        data: {
          type: 'objects',
          attributes: { name: fileName },
          relationships: {
            target: { data: { type: 'folders', id: folderId } },
          },
        },
      },
      { accessToken },
    );
    return storage?.data?.id ?? null;
  } catch (cause) {
    throw sanitizeApsError(
      cause,
      'Upload was rejected. Sign out and sign in again to grant upload access, ' +
        'or check that you have edit permission on this folder.',
    );
  }
};

/** Builds the JSON:API payload for a brand-new item + its first version. */
const buildCreateItemPayload = (folderId, fileName, storageId) => ({
  jsonapi: { version: '1.0' },
  data: {
    type: 'items',
    attributes: { displayName: fileName, extension: BIM360_ITEM_EXT },
    relationships: {
      tip: { data: { type: 'versions', id: '1' } },
      parent: { data: { type: 'folders', id: folderId } },
    },
  },
  included: [
    {
      type: 'versions',
      id: '1',
      attributes: { name: fileName, extension: BIM360_VERSION_EXT },
      relationships: {
        storage: { data: { type: 'objects', id: storageId } },
      },
    },
  ],
});

/** Builds the JSON:API payload for a new version of an existing item. */
const buildCreateVersionPayload = (itemId, fileName, storageId) => ({
  jsonapi: { version: '1.0' },
  data: {
    type: 'versions',
    attributes: { name: fileName, extension: BIM360_VERSION_EXT },
    relationships: {
      item: { data: { type: 'items', id: itemId } },
      storage: { data: { type: 'objects', id: storageId } },
    },
  },
});

/**
 * Uploads a file into a folder. Creates a new item, or a new version when a
 * file with the same name already exists. Requires write access (enforced by
 * APS). Steps: allocate OSS storage -> upload bytes -> register item/version.
 * @returns {Promise<{ fileName: string, updated: boolean }>}
 */
export const uploadFileToFolder = async (
  projectId,
  folderId,
  fileName,
  buffer,
  accessToken,
) => {
  // 1. Allocate an OSS storage location targeted at the folder.
  const storageId = await createFolderStorage(
    projectId,
    folderId,
    fileName,
    accessToken,
  );
  const parsed = parseStorageUrn(storageId);
  if (!parsed) {
    throw createHttpError(502, 'Failed to prepare upload.');
  }

  // 2. Upload the bytes to the storage object.
  try {
    await ossClient.uploadObject(parsed.bucketKey, parsed.objectKey, buffer, {
      accessToken,
    });
  } catch (cause) {
    throw sanitizeApsError(cause, 'Failed to upload the file to storage.');
  }

  // 3. Register it: new version if the name already exists, else a new item.
  let existing = null;
  try {
    const contents = await listFolderContents(projectId, folderId, accessToken);
    existing =
      contents.find((e) => e.type === 'items' && e.name === fileName) ?? null;
  } catch {
    existing = null;
  }

  try {
    if (existing) {
      await dataClient.createVersion(
        projectId,
        buildCreateVersionPayload(existing.id, fileName, storageId),
        { accessToken },
      );
      return { fileName, updated: true };
    }

    await dataClient.createItem(
      projectId,
      buildCreateItemPayload(folderId, fileName, storageId),
      { accessToken },
    );
    return { fileName, updated: false };
  } catch (cause) {
    throw sanitizeApsError(
      cause,
      'The file was uploaded but could not be registered in the folder.',
    );
  }
};
