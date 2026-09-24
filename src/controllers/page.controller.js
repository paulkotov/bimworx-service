import { env } from '../config/env.js';
import { serializeForScript } from '../utils/serializeForScript.js';

/**
 * Renders the single-page viewer shell (EJS today, React mount point tomorrow).
 * Server-side state is injected via window.__APP_CONFIG__ in the template.
 */
export const renderHome = (_req, res) => {
  const appConfig = {
    env: env.nodeEnv,
    // Placeholder until Google auth lands; the client treats null as "signed out".
    user: null,
    // Placeholder until the APS analysis pipeline emits snapshots.
    model: null,
  };

  res.render('index', {
    title: 'bimworx · Revit model viewer',
    // Pre-serialized safely for inline <script> embedding (guards against XSS
    // once user-controlled fields like the Drive file name are included).
    appConfigJson: serializeForScript(appConfig),
  });
};
