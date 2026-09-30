import {
  listHubs,
  listProjects,
  getProjectOverview,
  getFolderView,
} from '../services/apsData.js';
import {
  getItemDownloadInfo,
  uploadFileToFolder,
} from '../services/apsFiles.js';
import { createHttpError } from '../utils/httpError.js';

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

export const uploadToFolder = async (req, res, next) => {
  try {
    const { projectId, folderId } = req.params;
    const fileName = typeof req.query.name === 'string' ? req.query.name : '';

    if (!fileName) {
      throw createHttpError(400, 'A file name is required.', 'Missing file name');
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw createHttpError(400, 'The uploaded file is empty.', 'Empty upload body');
    }

    const result = await uploadFileToFolder(
      projectId,
      folderId,
      fileName,
      req.body,
      req.apsAccessToken,
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};
