import { env } from '../config/env.js';
import { serializeForScript } from '../utils/serializeForScript.js';
import {
  getHubsWithProjects,
  getProjectOverview,
  getFolderView,
} from '../services/apsData.js';
import { getItemViewInfo } from '../services/apsFiles.js';

/**
 * Page controllers stay thin: authentication is enforced by requireApsPage
 * (which sets req.apsAccessToken), aggregation lives in the service layer, and
 * these handlers only shape the view model and render.
 */

/**
 * Public landing page. Starts Autodesk OAuth via the Login control.
 * Already signed-in users go to hubs.
 */
export const renderLogin = (req, res) => {
  if (req.session?.aps?.accessToken) {
    res.redirect('/hubs');
    return;
  }

  res.render('login', {
    title: 'BimWorx · Login',
    activeNav: 'login',
  });
};

/**
 * App home: signed-in users land on hubs (viewer is opened from .rvt files).
 */
export const renderHome = (_req, res) => {
  res.redirect('/hubs');
};

/**
 * ACC hubs picker. Requires Autodesk session (see requireApsPage).
 */
export const renderHubs = async (req, res, next) => {
  try {
    let hubs = [];
    let warnings = [];
    let error = null;

    try {
      const result = await getHubsWithProjects(req.apsAccessToken);
      hubs = result.hubs;
      warnings = result.warnings;
    } catch (err) {
      error = err.publicMessage ?? err.message ?? 'Failed to list hubs.';
    }

    res.render('hubs', {
      title: 'BimWorx · ACC hubs',
      activeNav: 'hubs',
      authenticated: true,
      hubs,
      warnings,
      error,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Single project page: metadata, folders and their files/documents.
 * Requires Autodesk session (see requireApsPage).
 */
export const renderProject = async (req, res, next) => {
  try {
    const { hubId, projectId } = req.params;

    let overview = null;
    let error = null;

    try {
      overview = await getProjectOverview(hubId, projectId, req.apsAccessToken);
    } catch (err) {
      error = err.publicMessage ?? err.message ?? 'Failed to load project.';
    }

    res.render('project', {
      title: overview?.project?.name
        ? `BimWorx · ${overview.project.name}`
        : 'BimWorx · Project',
      activeNav: 'hubs',
      authenticated: true,
      hubId,
      projectId,
      overview,
      error,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Browse a single folder inside a project. Requires Autodesk session
 * (see requireApsPage).
 */
export const renderFolder = async (req, res, next) => {
  try {
    const { hubId, projectId, folderId } = req.params;

    let view = null;
    let error = null;

    try {
      view = await getFolderView(projectId, folderId, req.apsAccessToken);
    } catch (err) {
      error = err.publicMessage ?? err.message ?? 'Failed to load folder.';
    }

    res.render('folder', {
      title: view?.folder?.name
        ? `BimWorx · ${view.folder.name}`
        : 'BimWorx · Folder',
      activeNav: 'hubs',
      authenticated: true,
      hubId,
      projectId,
      view,
      error,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Autodesk Viewer for a single Revit (.rvt) item. Requires Autodesk session.
 */
export const renderItemViewer = async (req, res, next) => {
  try {
    const { hubId, projectId, itemId } = req.params;

    let viewInfo = null;
    let error = null;

    try {
      viewInfo = await getItemViewInfo(
        projectId,
        itemId,
        req.apsAccessToken,
      );
    } catch (err) {
      error = err.publicMessage ?? err.message ?? 'Failed to open the model.';
    }

    const appConfig = {
      env: env.nodeEnv,
      user: { provider: 'autodesk' },
      // 3-legged user token is required to view ACC / BIM 360 models.
      tokenUrl: '/api/auth/aps/token',
      model: viewInfo
        ? {
            urn: viewInfo.urn,
            fileName: viewInfo.fileName,
            status: 'ready',
          }
        : null,
      error,
      backHref: `/hubs/${encodeURIComponent(hubId)}/projects/${encodeURIComponent(projectId)}`,
    };

    res.render('index', {
      title: viewInfo?.fileName
        ? `BimWorx · ${viewInfo.fileName}`
        : 'BimWorx · Viewer',
      activeNav: 'hubs',
      authenticated: true,
      appConfigJson: serializeForScript(appConfig),
    });
  } catch (err) {
    next(err);
  }
};
