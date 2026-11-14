import { env } from '../config/env.js';
import { serializeForScript } from '../utils/serializeForScript.js';
import {
  getHubsWithProjects,
  getProjectOverview,
  getFolderView,
} from '../services/apsData.js';
import { getItemViewInfo } from '../services/apsFiles.js';
import { toModelDetailsShell } from '../viewModels/modelDetailsPage.js';
import { toFolderPage } from '../viewModels/folderPage.js';
import { toHubsPage } from '../viewModels/hubsPage.js';
import { toProjectPage } from '../viewModels/projectPage.js';
import { renderAppPage } from '../viewModels/renderAppPage.js';

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

  renderAppPage(res, 'login', {
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

    const page = toHubsPage({ hubs, warnings, error });

    renderAppPage(res, 'hubs', {
      title: page.title,
      activeNav: 'hubs',
      authenticated: true,
      page,
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

    const page = toProjectPage({ hubId, projectId, overview, error });

    renderAppPage(res, 'project', {
      title: page.title,
      activeNav: 'hubs',
      authenticated: true,
      page,
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

    const page = toFolderPage({ hubId, projectId, view, error });

    renderAppPage(res, 'folder', {
      title: page.title,
      activeNav: 'hubs',
      authenticated: true,
      page,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Model details shell. The report is loaded by the browser from the details API
 * so the page opens before BIM 360 responds.
 */
export const renderItemDetails = (req, res, next) => {
  try {
    const { hubId, projectId, itemId } = req.params;
    const page = toModelDetailsShell({ hubId, projectId, itemId });

    renderAppPage(res, 'details', {
      title: page.title,
      activeNav: 'hubs',
      authenticated: true,
      page,
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

    renderAppPage(res, 'index', {
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
