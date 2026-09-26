import { env } from '../config/env.js';
import { serializeForScript } from '../utils/serializeForScript.js';
import { listHubsWithMeta, listProjects } from '../services/apsData.js';
import { ensureApsAccessToken } from '../middlewares/requireApsAuth.js';

const redirectToLogin = (res) => res.redirect('/login');

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
 * Renders the single-page viewer shell (EJS today, React mount point tomorrow).
 * Requires Autodesk session.
 */
export const renderHome = (req, res) => {
  if (!req.session?.aps?.accessToken) {
    redirectToLogin(res);
    return;
  }

  const appConfig = {
    env: env.nodeEnv,
    user: { provider: 'autodesk' },
    // Placeholder until the APS analysis pipeline emits snapshots.
    model: null,
  };

  res.render('index', {
    title: 'BimWorx · Revit model viewer',
    activeNav: 'viewer',
    appConfigJson: serializeForScript(appConfig),
  });
};

/**
 * ACC hubs picker. Requires Autodesk session.
 */
export const renderHubs = async (req, res, next) => {
  try {
    const accessToken = await ensureApsAccessToken(req);
    if (!accessToken) {
      redirectToLogin(res);
      return;
    }

    let hubs = [];
    let warnings = [];
    let error = null;

    try {
      const result = await listHubsWithMeta(accessToken);
      hubs = result.hubs;
      warnings = result.warnings;
      hubs = await Promise.all(
        hubs.map(async (hub) => {
          try {
            const projects = await listProjects(hub.id, accessToken);
            return { ...hub, projects };
          } catch {
            return { ...hub, projects: [], projectsError: true };
          }
        }),
      );
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
