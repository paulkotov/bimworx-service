import {
  createUploadSession,
  finalizeTranslation,
  getTranslationStatus,
} from '../services/apsTranslation.js';
import { getTranslatedModelDetails } from '../services/apsModelDetails.js';
import { toTranslationDetailsPage } from '../viewModels/modelDetailsPage.js';
import { createHttpError } from '../utils/httpError.js';

export const createUpload = async (req, res, next) => {
  try {
    const { rootFilename, size } = req.body ?? {};
    if (typeof rootFilename !== 'string' || !rootFilename) {
      throw createHttpError(400, 'A root .rvt file name is required.', 'missing rootFilename');
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw createHttpError(400, 'A positive file size is required.', 'invalid size');
    }
    const session = await createUploadSession({ rootFilename, size });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

export const completeUpload = async (req, res, next) => {
  try {
    const { objectKey, uploadKey, size, eTags, rootFilename } = req.body ?? {};
    const result = await finalizeTranslation({ objectKey, uploadKey, size, eTags, rootFilename });
    res.status(202).json(result);
  } catch (err) {
    next(err);
  }
};

export const getStatus = async (req, res, next) => {
  try {
    const urn = typeof req.query.urn === 'string' ? req.query.urn : '';
    if (!urn) {
      throw createHttpError(400, 'A model URN is required.', 'missing urn');
    }
    const result = await getTranslationStatus(urn);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getTranslationReport = async (req, res, next) => {
  try {
    const urn = typeof req.query.urn === 'string' ? req.query.urn : '';
    const root = typeof req.query.root === 'string' ? req.query.root : '';
    let details = null;
    let error = null;

    try {
      details = await getTranslatedModelDetails(urn, root);
    } catch (err) {
      if (err.status === 400 || err.status === 503) {
        next(err);
        return;
      }
      error = err.publicMessage ?? err.message ?? 'Failed to load model details.';
    }

    const page = toTranslationDetailsPage({ urn, rootFilename: root, details, error });
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
