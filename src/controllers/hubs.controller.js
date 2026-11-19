import {
  listHubs,
  listProjects,
  getProjectOverview,
  getFolderView,
} from '../services/apsData.js';
import { randomUUID } from 'node:crypto';
import {
  getItemDownloadInfo,
  beginFolderUpload,
  putUploadPart,
  completeFolderUpload,
  deleteItemFromFolder,
} from '../services/apsFiles.js';
import { getItemModelDetails } from '../services/apsModelDetails.js';
import { createHttpError } from '../utils/httpError.js';
import { toModelDetailsPage } from '../viewModels/modelDetailsPage.js';

export const getHubs = async (req, res, next) => {
  try {
    const hubs = await listHubs(req.apsAccessToken);
    res.json(hubs);
  } catch (err) {
    next(err);
  }
};

export const getHubProjects = async (req, res, next) => {
  try {
    const projects = await listProjects(req.params.hubId, req.apsAccessToken);
    res.json(projects);
  } catch (err) {
    next(err);
  }
};

export const getProject = async (req, res, next) => {
  try {
    const { hubId, projectId } = req.params;
    const overview = await getProjectOverview(
      hubId,
      projectId,
      req.apsAccessToken,
    );
    res.json(overview);
  } catch (err) {
    next(err);
  }
};

export const getFolder = async (req, res, next) => {
  try {
    const { projectId, folderId } = req.params;
    const view = await getFolderView(projectId, folderId, req.apsAccessToken);
    res.json(view);
  } catch (err) {
    next(err);
  }
};

export const getItemDetails = async (req, res, next) => {
  try {
    const { hubId, projectId, itemId } = req.params;

    let details = null;
    let error = null;

    try {
      details = await getItemModelDetails(
        hubId,
        projectId,
        itemId,
        req.apsAccessToken,
      );
    } catch (err) {
      error = err.publicMessage ?? err.message ?? 'Failed to load model details.';
    }

    const page = toModelDetailsPage({ hubId, projectId, itemId, details, error });

    res.render('partials/detailsResult', { page }, (renderErr, html) => {
      if (renderErr) {
        next(renderErr);
        return;
      }
      res.json({
        title: page.title,
        fileName: page.fileName,
        html,
      });
    });
  } catch (err) {
    next(err);
  }
};

export const downloadItem = async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    const { url } = await getItemDownloadInfo(
      projectId,
      itemId,
      req.apsAccessToken,
    );
    // The signed S3 URL is short-lived; redirect the browser straight to it.
    res.redirect(url);
  } catch (err) {
    next(err);
  }
};

const uploadStore = (req) => {
  req.session.folderUploads ??= {};
  return req.session.folderUploads;
};

export const createFolderUpload = async (req, res, next) => {
  try {
    const { projectId, folderId } = req.params;
    const fileName = typeof req.body?.name === 'string' ? req.body.name : '';
    const { size } = req.body ?? {};
    if (!fileName) {
      throw createHttpError(400, 'A file name is required.', 'Missing file name');
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw createHttpError(400, 'A positive file size is required.', 'invalid size');
    }

    const session = await beginFolderUpload(
      projectId,
      folderId,
      fileName,
      size,
      req.apsAccessToken,
    );

    const uploadId = randomUUID();
    uploadStore(req)[uploadId] = {
      projectId,
      folderId,
      fileName: session.fileName,
      storageId: session.storageId,
      uploadKey: session.uploadKey,
      urls: session.urls,
      size,
      eTags: [],
    };

    res.status(201).json({
      uploadId,
      parts: session.parts,
      partSize: session.partSize,
      fileName: session.fileName,
    });
  } catch (err) {
    next(err);
  }
};

export const uploadFolderPart = async (req, res, next) => {
  try {
    const uploadId = typeof req.query.uploadId === 'string' ? req.query.uploadId : '';
    const index = Number(req.query.index);
    const record = uploadStore(req)[uploadId];
    if (!record) {
      throw createHttpError(409, 'The upload session expired. Start the upload again.', 'unknown uploadId');
    }
    if (!Number.isInteger(index) || index < 0 || index >= record.urls.length) {
      throw createHttpError(400, 'Invalid upload part.', `bad part index ${req.query.index}`);
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw createHttpError(400, 'The uploaded part is empty.', 'empty part body');
    }

    const eTag = await putUploadPart(record.urls[index], req.body);
    record.eTags[index] = eTag;
    res.status(200).json({ index });
  } catch (err) {
    next(err);
  }
};

export const finishFolderUpload = async (req, res, next) => {
  try {
    const uploadId = typeof req.body?.uploadId === 'string' ? req.body.uploadId : '';
    const store = uploadStore(req);
    const record = store[uploadId];
    if (!record) {
      throw createHttpError(409, 'The upload session expired. Start the upload again.', 'unknown uploadId');
    }

    const result = await completeFolderUpload({
      projectId: record.projectId,
      folderId: record.folderId,
      fileName: record.fileName,
      storageId: record.storageId,
      uploadKey: record.uploadKey,
      size: record.size,
      eTags: record.eTags,
      accessToken: req.apsAccessToken,
    });

    delete store[uploadId];
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

export const deleteFolderItem = async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    const result = await deleteItemFromFolder(projectId, itemId, req.apsAccessToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
